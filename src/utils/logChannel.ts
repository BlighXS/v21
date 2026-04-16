import type { Client } from "discord.js";
import { config } from "./config.js";
import { buildEmbed } from "./format.js";
import type { StyleKind } from "./format.js";
import { logger } from "./logger.js";

export async function sendToLogChannel(
  client: Client,
  title: string,
  body: string,
  kind: StyleKind = "info"
): Promise<void> {
  if (!config.LOG_CHANNEL_ID) return;
  try {
    const channel = client.channels.cache.get(config.LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;
    const embed = buildEmbed(title, body, kind);
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.warn({ error }, "Falha ao enviar mensagem para canal de log");
  }
}
