import { ActivityType } from "discord.js";
import type { BotEvent } from "../utils/events.js";

import { logger } from "../utils/logger.js";
import { buildEmbed } from "../utils/format.js";
import { scheduleDailyBackup } from "../backup/scheduler.js";

const ACTIVITIES = [
  { name: "Visual Studio 2022 | Compilando sonhos", type: ActivityType.Playing },
  { name: "/ajuda | Fawer Blight", type: ActivityType.Playing },
  { name: "a comunidade crescer", type: ActivityType.Watching },
  { name: "código sendo compilado", type: ActivityType.Watching },
  { name: "Spotify | ;spf <música>", type: ActivityType.Listening },
  { name: "Fawer IA | ;fwp <pergunta>", type: ActivityType.Playing }
];

let activityIndex = 0;

function rotateActivity(client: import("discord.js").Client) {
  const activity = ACTIVITIES[activityIndex % ACTIVITIES.length];
  client.user?.setPresence({
    activities: [{ name: activity.name, type: activity.type }],
    status: "online"
  });
  activityIndex++;
}

const event: BotEvent = {
  name: "clientReady",
  once: true,
  async execute(client) {
    logger.info({ user: client.user?.tag, guilds: client.guilds.cache.size }, "Bot online");

    rotateActivity(client);
    setInterval(() => rotateActivity(client), 5 * 60 * 1000).unref();

    scheduleDailyBackup(client);

    // Notifica o criador (BlightG7) via DM que o sistema voltou
    try {
      const creatorId = "892469618063589387";
      const creator = await client.users.fetch(creatorId);
      if (creator) {
        await creator.send("⚡ **Fawers** está de volta! Sistema reiniciado e pronto para a ação, Blight.");
        logger.info({ creatorId }, "Notificação de reinício enviada ao criador");
      }
    } catch (err) {
      logger.error({ err }, "Falha ao enviar notificação de reinício ao criador via DM");
    }

    try {
      const guilds = client.guilds.cache.values();
      for (const guild of guilds) {
        const logChannelId = process.env.LOG_CHANNEL_ID;
        const channel = logChannelId
          ? guild.channels.cache.get(logChannelId)
          : guild.channels.cache.find((ch) => ch.isTextBased() && "send" in ch);

        if (channel && channel.isTextBased()) {
          const totalMembers = guild.memberCount;
          const embed = buildEmbed(
            "Bot Online",
            [
              "🤖 **Fawer’Bot** está operacional!",
              `Servidor: **${guild.name}**`,
              `Membros: **${totalMembers}**`,
              `Use \`/ajuda\` para ver todos os comandos.`
            ].join("\n"),
            "ok"
          );
          await channel.send({ embeds: [embed] });
          logger.info({ channelId: channel.id, guildId: guild.id }, "Mensagem de ready enviada");
        }
      }
    } catch (error) {
      logger.error({ error }, "Falha ao enviar mensagem de ready");
    }
  }
};

export default event;