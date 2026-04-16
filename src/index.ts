import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Client, Collection, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import { loadCommands } from "./utils/loadCommands.js";
import { loadEvents } from "./utils/loadEvents.js";
import { logger } from "./utils/logger.js";

const fawEnvPath = path.join(process.cwd(), "faw.env");
if (fs.existsSync(fawEnvPath)) {
  dotenv.config({ path: fawEnvPath });
} else {
  dotenv.config();
}

const { config } = await import("./utils/config.js");

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
if (config.ENABLE_PREFIX) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({
  intents,
  partials: [Partials.Channel]
});

client.commands = new Collection();

await loadCommands(client);
await loadEvents(client);

if (config.DISCORD_CLIENT_ID) {
await registerSlashCommands();
} else {
  logger.warn("DISCORD_CLIENT_ID ausente: comandos slash nao serao registrados");
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
      logger.info("Registered guild commands");
    } else {
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commandsJson });
      logger.info("Registered global commands");
    }
  } catch (error) {
    logger.error({ error }, "Failed to register commands");
  }
}
