import type { BotEvent } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { buildEmbed } from "../utils/format.js";
import { scheduleDailyBackup } from "../backup/scheduler.js";

const event: BotEvent = {
  name: "ready",
  once: true,
  async execute(client) {
    logger.info({ user: client.user?.tag }, "Bot online");
    client.user?.setPresence({
      activities: [{ name: "Visual Studio 2022 | Compilando sonhos", type: 0 }],
      status: "online"
    });
    scheduleDailyBackup(client);
    try {
      const guilds = client.guilds.cache.values();
      for (const guild of guilds) {
        const channel = guild.channels.cache.find(
          (ch) => ch.isTextBased() && "send" in ch
        );
        if (channel && channel.isTextBased()) {
          const embed = buildEmbed("Online", "Fawer'Bot online. Pronto para operar.", "ok");
          await channel.send({ embeds: [embed] });
          logger.info({
            type: "auto",
            action: "ready-message",
            channelId: channel.id,
            guildId: guild.id
          }, "Sent ready message");
        }
      }
    } catch (error) {
      logger.error({ error }, "Failed to send ready message");
    }
  }
};

export default event;
