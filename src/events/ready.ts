import { ActivityType } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { buildEmbed } from "../utils/format.js";
import { scheduleDailyBackup } from "../backup/scheduler.js";

const ACTIVITIES = [
  { name: "Visual Studio 2022 | Compilando sonhos", type: ActivityType.Playing },
  { name: "/ajuda | Fawer Blight", type: ActivityType.Playing },
  { name: "a comunidade crescer", type: ActivityType.Watching },
  { name: "c\u00f3digo sendo compilado", type: ActivityType.Watching },
  { name: "Spotify | ;spf <m\u00fasica>", type: ActivityType.Listening },
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
              "\u{1F916} **Fawer\u2019Bot** est\u00e1 operacional!",
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
