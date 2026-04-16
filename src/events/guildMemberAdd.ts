import type { GuildMember } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { buildEmbed } from "../utils/format.js";
import { logger } from "../utils/logger.js";
import { sendToLogChannel } from "../utils/logChannel.js";

const event: BotEvent = {
  name: "guildMemberAdd",
  async execute(member: GuildMember) {
    const guild = member.guild;
    const user = member.user;
    const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`;
    const memberCount = guild.memberCount;

    logger.info({ guildId: guild.id, userId: user.id, tag: user.tag }, "Novo membro entrou");

    const embed = buildEmbed(
      "Bem-vindo ao servidor!",
      [
        `\u{1F44B} **${user.tag}** entrou no servidor!`,
        `Conta criada: ${createdAt}`,
        `Total de membros: **${memberCount}**`
      ].join("\n"),
      "ok"
    );

    if (user.displayAvatarURL()) {
      embed.setThumbnail(user.displayAvatarURL({ size: 128 }));
    }

    const welcomeChannel = guild.channels.cache.find(
      (c) =>
        c.isTextBased() &&
        "send" in c &&
        (c.name === "geral" || c.name === "bem-vindo" || c.name === "boas-vindas" || c.name === "welcome")
    );

    if (welcomeChannel && welcomeChannel.isTextBased()) {
      try {
        await welcomeChannel.send({ content: `<@${user.id}>`, embeds: [embed] });
      } catch (error) {
        logger.warn({ error }, "Falha ao enviar mensagem de boas-vindas");
      }
    }

    await sendToLogChannel(
      member.client,
      "Membro entrou",
      `**${user.tag}** (${user.id}) entrou no servidor **${guild.name}**. Total: ${memberCount}`,
      "ok"
    );
  }
};

export default event;
