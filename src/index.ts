import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  DMChannel,
} from "discord.js";

import { loadCommands } from "./utils/loadCommands.js";
import { loadEvents } from "./utils/loadEvents.js";
import { logger } from "./utils/logger.js";
import { config } from "./utils/config.js";

// AI imports (removido dynamic import)
import { loadTrainingData } from "./training/store.js";
import { queryWithFallback } from "./ai/fallback.js";
import { getProvider } from "./ai/providerConfig.js";
import { clearUserMemory, migrateMemoryKeys } from "./ai/memory.js";
import { buildEmbed, truncate } from "./utils/format.js";
import { isFreeModeOwner } from "./ai/freeMode.js";
import {
  stripFwpActionBlocks,
  buildFileReadFollowUp,
  executeFwpActions,
} from "./ai/actions.js";
import { buildAutonomousSystemPrompt } from "./ai/memorial.js";

// ================= ENV =================
const fawEnvPath = path.join(process.cwd(), "faw.env");
dotenv.config({
  path: fs.existsSync(fawEnvPath) ? fawEnvPath : undefined,
  override: true,
});

await migrateMemoryKeys().catch(() => {});

// ================= INTENTS =================
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.MessageContent,
];

if (config.ENABLE_PREFIX) {
  intents.push(GatewayIntentBits.GuildMessages);
}

// ================= CLIENT =================
const client = new Client({
  intents,
  partials: [Partials.Channel],
});

client.commands = new Collection();

// ================= LOAD =================
await loadCommands(client);
await loadEvents(client);

// ================= SLASH =================
if (config.DISCORD_CLIENT_ID) {
  await registerSlashCommands();
} else {
  logger.warn("DISCORD_CLIENT_ID ausente");
}

// ================= ERROR =================
client.on("error", (err) => {
  logger.error({ err }, "Discord client error");
});

// ================= ANTI FLOOD =================
const dmProcessing = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [id, time] of dmProcessing) {
    if (now - time > 30000) dmProcessing.delete(id);
  }
}, 10000);

// ================= DM HANDLER =================
client.ws.on("MESSAGE_CREATE", async (data: any) => {
  try {
    if (data?.guild_id) return;
    if (!data?.author || data.author.bot) return;

    const rawContent = data.content?.trim();
    if (!rawContent) return;

    const msgId = data.id;
    if (dmProcessing.has(msgId)) return;
    dmProcessing.set(msgId, Date.now());

    logger.info(
      {
        authorId: data.author.id,
        content: rawContent.slice(0, 60),
      },
      "DM recebida",
    );

    const channel = await client.channels.fetch(data.channel_id);
    if (!channel || !(channel instanceof DMChannel)) return;

    const ch = channel;
    const prefix = config.PREFIX;

    // ================= COMMANDS =================

    if (rawContent.startsWith(`${prefix}setup fwp`)) {
      if (!isFreeModeOwner(data.author.id)) {
        await ch.send({
          embeds: [buildEmbed("Acesso negado", "Sem permissão.", "warn")],
        });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("fwp_model_beta")
          .setLabel("Motor Beta")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("fwp_model_v2")
          .setLabel("FAWER V2")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("fwp_model_v3")
          .setLabel("FAWER V3")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("fwp_model_v4")
          .setLabel("FAWER V4")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("fwp_model_v5")
          .setLabel("FAWER V5")
          .setStyle(ButtonStyle.Primary),
      );

      await ch.send({
        embeds: [buildEmbed("Setup — Fawers", "Escolha a versão:", "info")],
        components: [row],
      });
      return;
    }

    if (rawContent === `${prefix}fwp limpar`) {
      await clearUserMemory(data.author.id);
      await ch.send({ embeds: [buildEmbed("Memória", "apagada.", "ok")] });
      return;
    }

    // ================= AI =================

    const trainingData = await loadTrainingData();
    const baseIdentity =
      trainingData.compiledIdentity || trainingData.baseIdentity;
    const systemPrompt = await buildAutonomousSystemPrompt(baseIdentity).catch(
      () => baseIdentity,
    );
    const memoryKey = data.author.id;

    // typing seguro
    let typing = true;
    (async () => {
      while (typing) {
        await ch.sendTyping().catch(() => {});
        await new Promise((r) => setTimeout(r, 8000));
      }
    })();

    try {
      const provider = await getProvider();
      const contextualContent = `[Via DM]: ${rawContent}`;

      const raw = await queryWithFallback(
        provider,
        systemPrompt,
        memoryKey,
        contextualContent,
      );

      const reply = stripFwpActionBlocks(raw)
        .replace(/^\[SILENT\]/, "")
        .trim();
      if (reply) await ch.send(truncate(reply, 1900));

      logger.info({ authorId: data.author.id }, "DM respondida");

      const fullMsg = await ch.messages.fetch(data.id);

      const firstPass = await executeFwpActions(fullMsg, raw);

      for (const report of firstPass.reports) {
        await ch.send(`> ${report}`).catch(() => {});
      }

      let pendingReads = firstPass.fileReads;

      for (let pass = 0; pass < 6 && pendingReads.length > 0; pass++) {
        const followUpQuery = buildFileReadFollowUp(pendingReads);

        const followRaw = await queryWithFallback(
          provider,
          systemPrompt,
          memoryKey,
          followUpQuery,
        );

        const followPass = await executeFwpActions(fullMsg, followRaw);

        const followReply = stripFwpActionBlocks(followRaw).trim();
        if (followReply) await ch.send(truncate(followReply, 1900));

        for (const report of followPass.reports) {
          await ch.send(`> ${report}`).catch(() => {});
        }

        pendingReads = followPass.fileReads;
      }
    } catch (err) {
      logger.error({ err }, "Erro AI");
      const errMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isOverload = errMsg.includes("503") || errMsg.includes("overloaded") || errMsg.includes("rate limit") || errMsg.includes("429");
      await ch.send(
        isOverload
          ? "Todos os motores estão sobrecarregados no momento. Tenta de novo em instantes."
          : "Ocorreu um erro interno ao processar sua mensagem. Tenta novamente."
      ).catch(() => {});
    } finally {
      typing = false;
    }
  } catch (err) {
    logger.error({ err }, "Erro geral DM");
  }
});

// ================= LOGIN =================
client.login(config.DISCORD_TOKEN);

// ================= SLASH =================
async function registerSlashCommands() {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  const commandsJson = client.commands.map((cmd) => cmd.data.toJSON());

  try {
    if (config.DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          config.DISCORD_CLIENT_ID,
          config.DISCORD_GUILD_ID,
        ),
        { body: commandsJson },
      );
    } else {
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
        body: commandsJson,
      });
    }

    logger.info({ count: commandsJson.length }, "Slash OK");
  } catch (error) {
    logger.error({ error }, "Erro slash");
  }
}
