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
  partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();

await loadCommands(client);
await loadEvents(client);

if (config.DISCORD_CLIENT_ID) {
  await registerSlashCommands();
} else {
  logger.warn("DISCORD_CLIENT_ID ausente: comandos slash n\u00e3o ser\u00e3o registrados");
}

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
