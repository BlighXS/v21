import type { Client, Guild } from "discord.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { createBackup } from "./backup.js";
import { loadBackupIndex } from "./store.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function resolveGuild(client: Client): Guild | null {
  if (config.DISCORD_GUILD_ID) {
    return client.guilds.cache.get(config.DISCORD_GUILD_ID) ?? null;
  }
  return client.guilds.cache.first() ?? null;
}

function isRecentAuto(name: string): boolean {
  return name.startsWith("[AUTO]");
}

export async function scheduleDailyBackup(client: Client) {
  const guild = resolveGuild(client);
  if (!guild) {
    logger.warn("Backup diario: guild nao encontrada");
    return;
  }

  const run = async () => {
    try {
      const date = new Date();
      const name = `[AUTO] ${date.toISOString().slice(0, 10)}`;
      await createBackup(guild, name);
      logger.info({ guildId: guild.id }, "Backup diario criado");
    } catch (error) {
      logger.error({ error }, "Falha no backup diario");
    }
  };

  try {
    const index = await loadBackupIndex();
    const lastAuto = index.backups.find((b) => isRecentAuto(b.name));
    if (!lastAuto) {
      await run();
    } else {
      const lastTime = new Date(lastAuto.createdAt).getTime();
      if (Date.now() - lastTime > ONE_DAY_MS - 60 * 1000) {
        await run();
      }
    }
  } catch (error) {
    logger.error({ error }, "Falha ao verificar backup diario");
  }

  setInterval(run, ONE_DAY_MS).unref();
}
