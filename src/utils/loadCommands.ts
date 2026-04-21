import { readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "discord.js";
import type { SlashCommand } from "./types.js";
import { logger } from "./logger.js";
import { registerPrefixCommand, type PrefixCommand } from "../ai/commandRegistry.js";

const CODESPACE_COMMANDS_DIR = path.join(process.cwd(), "src", "fawers_codespaces", "commands");

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

  await loadCodespaceCommands(client);
}

export async function loadCodespaceCommands(client: Client) {
  if (!existsSync(CODESPACE_COMMANDS_DIR)) {
    await mkdir(CODESPACE_COMMANDS_DIR, { recursive: true });
    return;
  }

  let files: string[] = [];
  try {
    files = await walk(CODESPACE_COMMANDS_DIR);
  } catch (err) {
    logger.warn({ err }, "Erro ao ler pasta de comandos do codespace");
    return;
  }

  const commandFiles = files.filter(
    (f) => (f.endsWith(".js") || f.endsWith(".ts")) && !f.endsWith(".d.ts"),
  );

  let slashCount = 0;
  let prefixCount = 0;

  for (const file of commandFiles) {
    try {
      const url = pathToFileURL(file).toString();
      const mod = await import(url);

      if (mod.default?.data?.name) {
        const command = mod.default as SlashCommand;
        if (!client.commands.has(command.data.name)) {
          client.commands.set(command.data.name, command);
          slashCount++;
        }
      }

      if (mod.prefixCommand?.trigger) {
        const cmd = mod.prefixCommand as PrefixCommand;
        registerPrefixCommand(cmd);
        prefixCount++;
      }
    } catch (err) {
      logger.error({ err, file }, "Erro ao carregar comando do codespace");
    }
  }

  if (slashCount + prefixCount > 0) {
    logger.info({ slashCount, prefixCount }, "Comandos do codespace carregados");
  }
}

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
