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

  const registeredCounts: Record<string, number> = {};

  for (const file of eventFiles) {
    const mod = await import(pathToFileURL(file).toString());

    const raw = mod.default;
    if (!raw) {
      logger.warn({ file }, "Event file missing default export, skipping");
      continue;
    }

    const events: BotEvent[] = Array.isArray(raw) ? raw : [raw];

    for (const event of events) {
      if (!event || typeof event.name !== "string" || typeof event.execute !== "function") {
        logger.warn({ file }, "Invalid event shape, skipping entry");
        continue;
      }
      registerEvent(client, event);
      registeredCounts[event.name] = (registeredCounts[event.name] ?? 0) + 1;
    }
  }

  const totalHandlers = Object.values(registeredCounts).reduce((a, b) => a + b, 0);
  logger.info({ count: eventFiles.length, handlers: totalHandlers, breakdown: registeredCounts }, "Loaded events");
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
