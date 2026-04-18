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

// static imports (performance)
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

// env
const fawEnvPath = path.join(process.cwd(), "faw.env");
dotenv.config({
  path: fs.existsSync(fawEnvPath) ? fawEnvPath : undefined,
  override: true,
});

await migrateMemoryKeys().catch((e) =>
  logger.warn({ e }, "memory migrate falhou"),
);

// minimal intents
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.MessageContent,
];

if (config.ENABLE_PREFIX) {
  intents.push(GatewayIntentBits.GuildMessages);
}

const client = new Client({
  intents,
  partials: [Partials.Channel],
});

client.commands = new Collection();

await loadCommands(client);
await loadEvents(client);

if (config.DISCORD_CLIENT_ID) {
  await registerSlashCommands();
}

client.on("error", (err) => {
  logger.error({ err }, "client error");
});

// anti flood map (timestamp)
const dmProcessing = new Map<string, number>();
const DM_COOLDOWN = 30_000;

setInterval(() => {
  const now = Date.now();
  for (const [id, time] of dmProcessing) {
    if (now - time > DM_COOLDOWN) dmProcessing.delete(id);
  }
}, 10_000);

client.ws.on("MESSAGE_CREATE", async (data: any) => {
  try {
    if (data?.guild_id) return;
    if (!data?.author || data.author.bot) return;

    const content = data.content?.trim();
    if (!content) return;

    if (dmProcessing.has(data.id)) return;
    dmProcessing.set(data.id, Date.now());

    const channel = await client.channels.fetch(data.channel_id);
    if (!channel || !(channel instanceof DMChannel)) return;

    const ch = channel;
    const prefix = config.PREFIX;

    // comandos
    if (content.startsWith(`${prefix}setup fwp`)) {
      if (!isFreeModeOwner(data.author.id)) {
        return ch.send({
          embeds: [buildEmbed("negado", "sem permissão", "warn")],
        });
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("fwp_model_v2")
          .setLabel("V2")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("fwp_model_v3")
          .setLabel("V3")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("fwp_model_v4")
          .setLabel("V4")
          .setStyle(ButtonStyle.Danger),
      );

      return ch.send({
        embeds: [buildEmbed("setup", "escolhe modelo", "info")],
        components: [row],
      });
    }

    if (content === `${prefix}fwp limpar`) {
      await clearUserMemory(data.author.id);
      return ch.send({ embeds: [buildEmbed("memória", "apagada", "ok")] });
    }

    // AI
    const trainingData = await loadTrainingData();
    const base = trainingData.compiledIdentity || trainingData.baseIdentity;
    const systemPrompt = await buildAutonomousSystemPrompt(base);

    const memoryKey = data.author.id;

    // typing safe loop
    let typing = true;
    const typingLoop = async () => {
      while (typing) {
        await ch.sendTyping().catch(() => {});
        await new Promise((r) => setTimeout(r, 8000));
      }
    };
    typingLoop();

    try {
      const provider = await getProvider();
      const input = `[DM]: ${content}`;

      let raw = await queryWithFallback(
        provider,
        systemPrompt,
        memoryKey,
        input,
      );

      const reply = stripFwpActionBlocks(raw).trim();
      if (reply) await ch.send(truncate(reply, 1900));

      const fullMsg = await ch.messages.fetch(data.id);

      let pass = await executeFwpActions(fullMsg, raw);
      let pending = pass.fileReads;

      for (let i = 0; i < 3 && pending.length; i++) {
        const follow = buildFileReadFollowUp(pending);
        const followRaw = await queryWithFallback(
          provider,
          systemPrompt,
          memoryKey,
          follow,
        );

        const next = await executeFwpActions(fullMsg, followRaw);
        const followReply = stripFwpActionBlocks(followRaw).trim();

        if (followReply) await ch.send(truncate(followReply, 1900));

        pending = next.fileReads;
      }
    } catch (err) {
      logger.error({ err }, "erro AI");
      await ch.send("deu erro, tenta dnv").catch(() => {});
    } finally {
      typing = false;
    }
  } catch (err) {
    logger.error({ err }, "erro geral DM");
  }
});

client.login(config.DISCORD_TOKEN);

async function registerSlashCommands() {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  const commandsJson = client.commands.map((c) => c.data.toJSON());

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

    logger.info({ count: commandsJson.length }, "slash ok");
  } catch (e) {
    logger.error({ e }, "erro slash");
  }
}
