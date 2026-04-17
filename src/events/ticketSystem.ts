import { Message, Interaction, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel } from 'discord.js';
import type { BotEvent } from '../utils/events.js';
import { logger } from '../utils/logger.js';

const OWNER_ID = '892469618063589387';
const STAFF_ROLE_ID = '1493064608154652903'; // Cargo autorizado
const TICKET_CATEGORY_ID = '1493062369285505205';

const ticketEvents: BotEvent[] = [
  {
    name: 'messageCreate',
    execute: async (message: Message) => {
      if (message.author.id !== OWNER_ID || message.author.bot) return;
      if (message.content.toLowerCase() !== '!ticket-setup') return;

      const embed = new EmbedBuilder()
        .setTitle('🎫 Central de Suporte — FAW')
        .setDescription('Precisa de ajuda técnica, reportar um bug ou falar com a administração?\n\nClique no botão abaixo para abrir um ticket de suporte privado.')
        .setColor(0x2f3136)
        .setFooter({ text: 'Fawers Ticket System' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('faw_open_ticket')
          .setLabel('Abrir Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📩')
      );

      await message.channel.send({ embeds: [embed], components: [row] });
      await message.delete().catch(() => {});
    }
  },
  {
    name: 'interactionCreate',
    execute: async (interaction: Interaction) => {
      if (!interaction.isButton()) return;

      const guild = interaction.guild;
      if (!guild) return;

      if (interaction.customId === 'faw_open_ticket') {
        await interaction.deferReply({ ephemeral: true });

        const channelName = `ticket-${interaction.user.username}`.toLowerCase();

        try {
          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: [
              {
                id: guild.id, // @everyone
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
              {
                id: interaction.user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
              },
              {
                id: STAFF_ROLE_ID,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
              },
              {
                id: OWNER_ID,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
              }
            ],
            reason: `Ticket aberto por ${interaction.user.tag}`
          });

          const embed = new EmbedBuilder()
            .setTitle('🎟️ Ticket Aberto')
            .setDescription(`Olá ${interaction.user}, descreva seu problema ou dúvida abaixo.\n\nA equipe de suporte (<@&${STAFF_ROLE_ID}>) e o <@${OWNER_ID}> foram notificados.`)
            .setColor(0x57f287);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('faw_close_ticket')
              .setLabel('Fechar Ticket')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒')
          );

          await ticketChannel.send({ 
            content: `<@${interaction.user.id}> | <@&${STAFF_ROLE_ID}>`,
            embeds: [embed], 
            components: [row] 
          });

          await interaction.editReply({ content: `Seu ticket foi criado em ${ticketChannel}` });
        } catch (err) {
          logger.error({ err }, 'Erro ao criar ticket');
          await interaction.editReply({ content: 'Erro ao abrir o ticket.' });
        }
      }

      if (interaction.customId === 'faw_close_ticket') {
        const channel = interaction.channel as TextChannel;
        await interaction.reply({ content: '🔒 Fechando o ticket em 5 segundos...' });
        setTimeout(() => channel.delete().catch(() => {}), 5000);
      }
    }
  }
];

export default ticketEvents;