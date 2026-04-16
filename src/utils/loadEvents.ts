import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "discord.js";
import { logger } from "./logger.js";
import type { BotEvent } from "./events.js";
import { registerEvent } from "./events.js";

export async function loadEvents(client: Client) {
  const eventsPath = path.join(process.cwd(), "src", "events");
  const files = await walk(eventsPath);
  const eventFiles = files.filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of eventFiles) {
    const mod = await import(pathToFileURL(file).toString());
    const event = mod.default as BotEvent | undefined;

    if (!event) {
      logger.warn({ file }, "Event missing default export");
      continue;
    }

    registerEvent(client, event);
  }

  logger.info({ count: eventFiles.length }, "Loaded events");
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
