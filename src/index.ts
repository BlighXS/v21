import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Client, Collection, GatewayIntentBits, Partials, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { loadCommands } from "./utils/loadCommands.js";
import { loadEvents } from "./utils/loadEvents.js";
import { logger } from "./utils/logger.js";

const fawEnvPath = path.join(process.cwd(), "faw.env");
if (fs.existsSync(fawEnvPath)) {
  dotenv.config({ path: fawEnvPath, override: true });
} else {
  dotenv.config({ override: true });
}

const { config } = await import("./utils/config.js");

const { migrateMemoryKeys } = await import("./ai/memory.js");
await migrateMemoryKeys().catch(() => {});

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.DirectMessageTyping,
  GatewayIntentBits.MessageContent
];

if (config.ENABLE_PREFIX) {
  intents.push(GatewayIntentBits.GuildMessages);
}

const client = new Client({
  intents,
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.commands = new Collection();

await loadCommands(client);
await loadEvents(client);

if (config.DISCORD_CLIENT_ID) {
  await registerSlashCommands();
} else {
  logger.warn("DISCORD_CLIENT_ID ausente: comandos slash n\u00e3o ser\u00e3o registrados");
}

client.on("error", (err) => {
  logger.error({ err }, "Discord client error");
});

// DM handler via raw gateway (messageCreate partial processing unreliable for DMs)
const dmProcessing = new Set<string>();
client.ws.on("MESSAGE_CREATE" as any, async (data: any) => {
  if (data?.guild_id) return;
  if (!data?.author || data.author.bot) return;
  const rawContent = data.content?.trim();
  if (!rawContent) return;

  const msgId = data.id;
  if (dmProcessing.has(msgId)) return;
  dmProcessing.add(msgId);
  setTimeout(() => dmProcessing.delete(msgId), 30_000);

  logger.info({ authorId: data.author.id, content: rawContent.slice(0, 60) }, "DM recebida");

  try {
    const { loadTrainingData } = await import("./training/store.js");
    const { queryWithFallback } = await import("./ai/fallback.js");
    const { getProvider } = await import("./ai/providerConfig.js");
    const { clearUserMemory } = await import("./ai/memory.js");
    const { buildEmbed, truncate } = await import("./utils/format.js");
    const { isFreeModeOwner } = await import("./ai/freeMode.js");
    const { stripFwpActionBlocks, buildFileReadFollowUp } = await import("./ai/actions.js");
    const { buildAutonomousSystemPrompt } = await import("./ai/memorial.js");
    const { config: cfg } = await import("./utils/config.js");

    const channel = await client.channels.fetch(data.channel_id);
    if (!channel || !("send" in channel)) return;
    const ch = channel as import("discord.js").DMChannel;

    const prefix = cfg.PREFIX;

    // Handle ;setup fwp command
    if (rawContent === `${prefix}setup fwp` || rawContent.startsWith(`${prefix}setup fwp`)) {
      if (!isFreeModeOwner(data.author.id)) {
        await ch.send({ embeds: [buildEmbed("Acesso negado", "Sem permissão para acessar o setup.", "warn")] });
        return;
      }
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("fwp_model_beta").setLabel("Motor Beta").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("fwp_model_v2").setLabel("FAWER V2").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("fwp_model_v3").setLabel("FAWER V3").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("fwp_model_v4").setLabel("FAWER V4").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("fwp_model_v5").setLabel("FAWER V5").setStyle(ButtonStyle.Primary)
      );
      await ch.send({ embeds: [buildEmbed("Setup — Fawers", "Qual versão da Fawers você quer ativar?", "info")], components: [row] });
      return;
    }

    // Handle ;fwp limpar
    if (rawContent === `${prefix}fwp limpar`) {
      await clearUserMemory(data.author.id);
      await ch.send({ embeds: [buildEmbed("Memória", "Memória apagada.", "ok")] });
      return;
    }

    // AI response
    const trainingData = await loadTrainingData();
    const baseIdentity = trainingData.compiledIdentity || trainingData.baseIdentity;
    const systemPrompt = await buildAutonomousSystemPrompt(baseIdentity).catch(() => baseIdentity);
    const memoryKey = data.author.id;

    ch.sendTyping().catch(() => {});
    const typingInterval = setInterval(() => ch.sendTyping().catch(() => {}), 8000);

    try {
      const provider = await getProvider();
      const contextualContent = `[Via DM]: ${rawContent}`;
      let raw: string;
      if (provider === "ollama") {
        const { queryGemini, GEMINI_MODEL_V3 } = await import("./ai/gemini.js");
        raw = await queryGemini(systemPrompt, memoryKey, contextualContent, GEMINI_MODEL_V3);
      } else {
        raw = await queryWithFallback(provider, systemPrompt, memoryKey, contextualContent);
      }
      const reply = stripFwpActionBlocks(raw).replace(/^\[SILENT\]/, "").trim();
      if (reply) await ch.send(truncate(reply, 1900));
      logger.info({ authorId: data.author.id }, "DM respondida");

      // Execute FWP actions if any (fetch real Message object for the action executor)
      const { executeFwpActions } = await import("./ai/actions.js");
      try {
        const fullMsg = await ch.messages.fetch(data.id);
        const firstPass = await executeFwpActions(fullMsg, raw);
        for (const report of firstPass.reports) {
          await ch.send(`> ${report}`).catch(() => {});
        }

        let pendingReads = firstPass.fileReads;
        const MAX_FOLLOW_UP_PASSES = 4;
        for (let pass = 0; pass < MAX_FOLLOW_UP_PASSES && pendingReads.length > 0; pass++) {
          try {
            const followUpQuery = buildFileReadFollowUp(pendingReads);
            let followRaw: string;
            if (provider === "ollama") {
              const { queryGemini, GEMINI_MODEL_V3 } = await import("./ai/gemini.js");
              followRaw = await queryGemini(systemPrompt, memoryKey, followUpQuery, GEMINI_MODEL_V3);
            } else {
              followRaw = await queryWithFallback(provider, systemPrompt, memoryKey, followUpQuery);
            }
            const followPass = await executeFwpActions(fullMsg, followRaw);
            const followReply = stripFwpActionBlocks(followRaw).replace(/^\[SILENT\]/, "").trim();
            if (followReply) await ch.send(truncate(followReply, 1900)).catch(() => {});
            for (const report of followPass.reports) {
              await ch.send(`> ${report}`).catch(() => {});
            }
            pendingReads = followPass.fileReads;
          } catch (followErr) {
            logger.warn({ followErr, pass }, "DM: passada de leitura falhou");
            await ch.send("⚠️ Tive um problema interno ao processar o arquivo. Pode repetir o pedido?").catch(() => {});
            break;
          }
        }
      } catch (actionErr) {
        logger.warn({ actionErr }, "Não foi possível executar ações FWP na DM");
      }
    } finally {
      clearInterval(typingInterval);
    }
  } catch (err) {
    logger.error({ err, authorId: data.author?.id }, "Erro ao responder DM");
    try {
      const ch = await client.channels.fetch(data.channel_id) as any;
      await ch?.send?.("Deu erro aqui, tenta de novo.").catch(() => {});
    } catch {}
  }
});

client.login(config.DISCORD_TOKEN);

const { startDashboard } = await import("./web/dashboard.js");
startDashboard(client);

async function registerSlashCommands() {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  const commandsJson = client.commands.map((cmd) => cmd.data.toJSON());

  try {
    if (config.DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
        { body: commandsJson }
      );
      logger.info({ count: commandsJson.length }, "Comandos registrados na guild");
    } else {
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commandsJson });
      logger.info({ count: commandsJson.length }, "Comandos globais registrados");
    }
  } catch (error) {
    logger.error({ error }, "Falha ao registrar comandos");
  }
}
