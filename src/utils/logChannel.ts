import type { Client, TextBasedChannel } from "discord.js";
import { config } from "./config.js";
import { buildEmbed } from "./format.js";
import type { StyleKind } from "./format.js";
import { logger } from "./logger.js";

let cachedChannel: TextBasedChannel | null = null;

export async function sendToLogChannel(
  client: Client,
  title: string,
  body: string,
  kind: StyleKind = "info",
): Promise<void> {
  if (!config.LOG_CHANNEL_ID) return;
  if (!client.isReady()) return;

  try {
    // evita buscar toda hora (performance)
    if (!cachedChannel) {
      const channel = await client.channels
        .fetch(config.LOG_CHANNEL_ID)
        .catch(() => null);

      if (!channel || !channel.isTextBased()) {
        logger.warn("Canal de log inválido ou não encontrado");
        return;
      }

      cachedChannel = channel;
    }

    const embed = buildEmbed(
      String(title).slice(0, 256),
      String(body).slice(0, 4000),
      kind,
    );

    await cachedChannel.send({ embeds: [embed] }).catch((error) => {
      logger.warn({ error }, "Erro ao enviar embed para canal de log");
    });
  } catch (error) {
    logger.warn({ error }, "Falha geral ao enviar mensagem para canal de log");
  }
}
