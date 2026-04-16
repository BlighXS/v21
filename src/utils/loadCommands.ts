import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "discord.js";
import type { SlashCommand } from "./types.js";
import { logger } from "./logger.js";

export async function loadCommands(client: Client) {
  const commandsPath = path.join(process.cwd(), "src", "commands");
  const files = await walk(commandsPath);
  const commandFiles = files.filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of commandFiles) {
    const mod = await import(pathToFileURL(file).toString());
    const command = mod.default as SlashCommand | undefined;

    if (!command) {
      logger.warn({ file }, "Command missing default export");
      continue;
    }

    client.commands.set(command.data.name, command);
  }

  logger.info({ count: client.commands.size }, "Loaded commands");
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(full));
    } else {
      files.push(full);
    }
  }

  return files;
}
