import type { Client, Guild, VoiceBasedChannel } from "discord.js";
import { logger } from "../utils/logger.js";

export async function playPreview(
  _client: Client,
  guild: Guild,
  channel: VoiceBasedChannel,
  previewUrl: string
) {
  logger.warn({ guildId: guild.id, channelId: channel.id, previewUrl }, "Voice preview is disabled");
}
