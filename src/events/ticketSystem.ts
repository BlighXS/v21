import {
  Message,
  Interaction,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
  GuildMember,
} from "discord.js";

import type { BotEvent } from "../utils/events.js";
import { logger } from "../utils/logger.js";

const OWNER_ID = process.env.OWNER_ID ?? "892469618063589387";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID ?? "1493064608154652903";
const TICKET_CATEGORY_ID =
  process.env.TICKET_CATEGORY_ID ?? "1493062369285505205";

// anti spam simples em memória
const openTickets = new Map<string, string>(); // userId -> channelId

function sanitizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 20);
}

async function userHasTicket(guild: any, userId: string) {
  return openTickets.has(userId);
}

const ticketEvents: BotEvent[] = [
  {
    name: "messageCreate",
    execute: async (message: Message) => {
      if (message.author.bot) return;
      if (message.author.id !== OWNER_ID) return;
      if (message.content.toLowerCase() !== "!ticket-setup") return;

      const embed = new EmbedBuilder()
        .setTitle("🎫 Central de Suporte")
        .setDescription(
          "Abra um ticket privado para suporte, bugs ou dúvidas.\nClique no botão abaixo.",
        )
        .setColor(0x2f3136)
        .setFooter({ text: "Ticket System" });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("faw_open_ticket")
          .setLabel("Abrir Ticket")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("📩"),
      );

      await message.channel.send({ embeds: [embed], components: [row] });
      await message.delete().catch(() => {});
    },
  },

  {
    name: "interactionCreate",
    execute: async (interaction: Interaction) => {
      if (!interaction.isButton()) return;
      if (!interaction.guild) return;

      const guild = interaction.guild;

      // =========================
      // ABRIR TICKET
      // =========================
      if (interaction.customId === "faw_open_ticket") {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;

        if (openTickets.has(userId)) {
          return interaction.editReply({
            content: "❌ Você já tem um ticket aberto.",
          });
        }

        const safeName = sanitizeName(interaction.user.username);
        const channelName = `ticket-${safeName}`;

        try {
          const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: [
              {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
              {
                id: userId,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                ],
              },
              {
                id: STAFF_ROLE_ID,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                ],
              },
              {
                id: OWNER_ID,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                ],
              },
            ],
            reason: `Ticket aberto por ${interaction.user.tag}`,
          });

          openTickets.set(userId, channel.id);

          const embed = new EmbedBuilder()
            .setTitle("🎟️ Ticket Aberto")
            .setDescription(
              `Olá <@${userId}>, descreva seu problema.\nEquipe: <@&${STAFF_ROLE_ID}>`,
            )
            .setColor(0x57f287);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("faw_close_ticket")
              .setLabel("Fechar Ticket")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("🔒"),
          );

          await channel.send({
            content: `<@${userId}> <@&${STAFF_ROLE_ID}>`,
            embeds: [embed],
            components: [row],
          });

          return interaction.editReply({
            content: `✅ Ticket criado: ${channel}`,
          });
        } catch (err) {
          logger.error({ err }, "Erro ao criar ticket");
          return interaction.editReply({
            content: "❌ Falha ao criar ticket.",
          });
        }
      }

      // =========================
      // FECHAR TICKET
      // =========================
      if (interaction.customId === "faw_close_ticket") {
        const channel = interaction.channel as TextChannel;
        if (!channel) return;

        const member = interaction.member as GuildMember;

        const isOwner =
          interaction.user.id === OWNER_ID ||
          member.roles.cache.has(STAFF_ROLE_ID);

        if (!isOwner) {
          return interaction.reply({
            content: "❌ Sem permissão para fechar ticket.",
            ephemeral: true,
          });
        }

        await interaction.reply({
          content: "🔒 Fechando ticket em 5s...",
        });

        const userId = [...openTickets.entries()].find(
          ([, chId]) => chId === channel.id,
        )?.[0];

        setTimeout(async () => {
          try {
            await channel.send("📁 Ticket finalizado e arquivado.");
            await channel.delete().catch(() => {});
            if (userId) openTickets.delete(userId);
          } catch (err) {
            logger.error({ err }, "Erro ao fechar ticket");
          }
        }, 5000);
      }
    },
  },
];

export default ticketEvents;
