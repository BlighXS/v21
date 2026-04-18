import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "discord.js";
import type { SlashCommand } from "./types.js";
import { logger } from "./logger.js";

export async function loadCommands(client: Client) {
  const commandsPath = path.join(process.cwd(), "src", "commands");

  let files: string[] = [];
  try {
    files = await walk(commandsPath);
  } catch (err) {
    logger.error({ err }, "Erro ao ler pasta de comandos");
    return;
  }

  const commandFiles = files.filter(
    (f) => (f.endsWith(".js") || f.endsWith(".ts")) && !f.endsWith(".d.ts"),
  );

  for (const file of commandFiles) {
    try {
      const mod = await import(pathToFileURL(file).toString());
      const command = mod.default as SlashCommand | undefined;

      if (!command) {
        logger.warn({ file }, "Command sem export default");
        continue;
      }

      if (!command.data?.name) {
        logger.warn({ file }, "Command inválido (sem nome)");
        continue;
      }

      if (client.commands.has(command.data.name)) {
        logger.warn({ name: command.data.name, file }, "Comando duplicado");
        continue;
      }

      client.commands.set(command.data.name, command);
    } catch (err) {
      logger.error({ err, file }, "Erro ao carregar comando");
    }
  }

  logger.info({ count: client.commands.size }, "Comandos carregados");
}

// ================= WALK =================

async function walk(dir: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    logger.error({ err, dir }, "Erro ao ler diretório");
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }

  return files;
}
