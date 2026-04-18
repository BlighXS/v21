import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "discord.js";
import { logger } from "./logger.js";
import type { BotEvent } from "./events.js";
import { registerEvent } from "./events.js";

export async function loadEvents(client: Client) {
  const eventsPath = path.join(process.cwd(), "src", "events");

  let files: string[] = [];
  try {
    files = await walk(eventsPath);
  } catch (err) {
    logger.error({ err }, "Erro ao ler pasta de eventos");
    return;
  }

  const eventFiles = files.filter(
    (f) => (f.endsWith(".js") || f.endsWith(".ts")) && !f.endsWith(".d.ts"),
  );

  const registeredCounts: Record<string, number> = {};

  for (const file of eventFiles) {
    try {
      const mod = await import(pathToFileURL(file).toString());

      const raw = mod.default;
      if (!raw) {
        logger.warn({ file }, "Event sem export default");
        continue;
      }

      const events: BotEvent[] = Array.isArray(raw) ? raw : [raw];

      for (const event of events) {
        if (
          !event ||
          typeof event.name !== "string" ||
          typeof event.execute !== "function"
        ) {
          logger.warn({ file }, "Evento inválido");
          continue;
        }

        registerEvent(client, event);
        registeredCounts[event.name] = (registeredCounts[event.name] ?? 0) + 1;
      }
    } catch (err) {
      logger.error({ err, file }, "Erro ao carregar evento");
    }
  }

  const totalHandlers = Object.values(registeredCounts).reduce(
    (a, b) => a + b,
    0,
  );

  logger.info(
    {
      files: eventFiles.length,
      handlers: totalHandlers,
      breakdown: registeredCounts,
    },
    "Eventos carregados",
  );
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
