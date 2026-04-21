import type { GuildMember, TextBasedChannel } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { buildEmbed } from "../utils/format.js";
import { logger } from "../utils/logger.js";
import { sendToLogChannel } from "../utils/logChannel.js";

const WELCOME_CHANNEL_NAMES = new Set([
  "geral",
  "bem-vindo",
  "boas-vindas",
  "welcome",
]);

function findWelcomeChannel(member: GuildMember): TextBasedChannel | null {
  const channels = member.guild.channels.cache;

  for (const ch of channels.values()) {
    if (!ch.isTextBased()) continue;
    if (!("send" in ch)) continue;
    if (!WELCOME_CHANNEL_NAMES.has(ch.name)) continue;

    // check permissão do bot
    const perms = ch.permissionsFor(member.client.user!);
    if (!perms?.has("SendMessages")) continue;

    return ch as TextBasedChannel;
  }

  return null;
}

const UNREG_ROLE_ID = "1495985456943202327";

const event: BotEvent = {
  name: "guildMemberAdd",

  async execute(member: GuildMember) {
    try {
      const { guild, user } = member;

      // Atribuir cargo de Não-Registrado automaticamente
      try {
        const unregRole = guild.roles.cache.get(UNREG_ROLE_ID);
        if (unregRole) {
          await member.roles.add(unregRole, "Cargo automático de novo membro");
          logger.info({ userId: user.id, roleId: UNREG_ROLE_ID }, "Cargo Não-Registrado atribuído");
        } else {
          logger.warn({ roleId: UNREG_ROLE_ID }, "Cargo Não-Registrado não encontrado no servidor");
        }
      } catch (roleError) {
        logger.warn({ roleError, userId: user.id }, "Falha ao atribuir cargo automático");
      }

      const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`;
      const memberCount = guild.memberCount;

      logger.info(
        { guildId: guild.id, userId: user.id, tag: user.tag },
        "Novo membro entrou",
      );

      const embed = buildEmbed(
        "Bem-vindo ao servidor!",
        [
          `👋 **${user.tag}** entrou no servidor!`,
          `Conta criada: ${createdAt}`,
          `Total de membros: **${memberCount}**`,
        ].join("\n"),
        "ok",
      );

      const avatar = user.displayAvatarURL({ size: 128 });
      if (avatar) embed.setThumbnail(avatar);

      const channel = findWelcomeChannel(member);

      if (channel) {
        try {
          await channel.send({
            content: `<@${user.id}>`,
            embeds: [embed],
          });
        } catch (error) {
          logger.warn(
            { error, channelId: channel.id },
            "Falha ao enviar boas-vindas",
          );
        }
      } else {
        logger.warn(
          { guildId: guild.id },
          "Nenhum canal de boas-vindas encontrado",
        );
      }

      await sendToLogChannel(
        member.client,
        "Membro entrou",
        `**${user.tag}** (${user.id}) entrou no servidor **${guild.name}**. Total: ${memberCount}`,
        "ok",
      );
    } catch (error) {
      logger.error({ error }, "Erro em guildMemberAdd");
    }
  },
};

export default event;
