import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Client, Collection, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
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

// Handle DMs directly from raw gateway events (Discord.js partial processing fails for DMs)
client.ws.on("MESSAGE_CREATE" as any, async (data: any) => {
  if (data?.guild_id) return; // only DMs
  if (!data?.author || data.author.bot) return;
  if (!data.content?.trim()) return;

  logger.info({ authorId: data.author?.id, content: data.content?.slice(0, 50) }, "Gateway RAW: processando DM");

  try {
    const { loadTrainingData } = await import("./training/store.js");
    const { queryGemini, GEMINI_MODEL_V3 } = await import("./ai/gemini.js");
    const { queryOpenAI } = await import("./ai/openai.js");
    const { getProvider } = await import("./ai/providerConfig.js");
    const { truncate } = await import("./utils/format.js");

    const channel = await client.channels.fetch(data.channel_id);
    if (!channel || !("send" in channel)) return;

    const trainingData = await loadTrainingData();
    const systemPrompt = trainingData.compiledIdentity || trainingData.baseIdentity;
    const memoryKey = `dm_${data.author.id}`;
    const content = data.content.trim();

    (channel as any).sendTyping?.().catch(() => {});

    const provider = await getProvider();
    let reply: string;

    if (provider === "openai-v4") {
      reply = await queryOpenAI(systemPrompt, memoryKey, content);
    } else {
      reply = await queryGemini(systemPrompt, memoryKey, content, provider === "gemini-v3" ? GEMINI_MODEL_V3 : undefined);
    }

    const text = reply.replace(/^\[SILENT\]/, "").trim();
    if (text) {
      await (channel as any).send(truncate(text, 1900));
    }

    logger.info({ authorId: data.author.id }, "DM respondida com sucesso");
  } catch (err) {
    logger.error({ err, authorId: data.author?.id }, "Falha ao responder DM via gateway raw");
    try {
      const channel = await client.channels.fetch(data.channel_id);
      if (channel && "send" in channel) {
        await (channel as any).send("Deu erro aqui, tenta de novo.");
      }
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
