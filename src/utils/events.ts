import type { Client } from "discord.js";
import { logger } from "./logger.js";

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void> | void;
}

export function registerEvent(client: Client, event: BotEvent) {
  const handler = async (...args: unknown[]) => {
    try {
      await event.execute(...args);
    } catch (err) {
      logger.error(
        { err, event: event.name },
        `Erro ao executar evento: ${event.name}`,
      );
    }
  };

  if (event.once) {
    client.once(event.name, handler);
  } else {
    client.on(event.name, handler);
  }
}
