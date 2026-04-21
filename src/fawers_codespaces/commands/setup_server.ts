import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  Message, 
  PermissionFlagsBits, 
  TextChannel 
} from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'setup-register',
  description: 'Inicializa o portal de registro interativo.',
  async execute(message: Message) {
    const OWNER_ID = '892469618063589387';
    const REG_CHANNEL_ID = '1495985460281999522';
    const UNREG_ROLE_ID = '1495985456943202327';
    const MEMBER_ROLE_ID = '1493095650555068576';

    if (message.author.id !== OWNER_ID) return message.reply('❌ Acesso restrito ao Dono.');
    if (message.channel.id !== REG_CHANNEL_ID) return message.reply(`❌ Execute este comando em <#${REG_CHANNEL_ID}>.`);

    const channel = message.channel as TextChannel;
    await channel.bulkDelete(100).catch(() => {});

    // Sincronização de Massa
    const members = await message.guild!.members.fetch();
    let synced = 0;
    for (const [id, member] of members) {
      if (!member.user.bot && !member.roles.cache.has(MEMBER_ROLE_ID) && !member.roles.cache.has(UNREG_ROLE_ID)) {
        await member.roles.add(UNREG_ROLE_ID).catch(() => {});
        synced++;
      }
    }

    // Interface de Registro
    const embed = new EmbedBuilder()
      .setTitle('🔰 PORTAL DE ACESSO - FAW')
      .setColor('#2b2d31')
      .setDescription(
        'Bem-vindo ao laboratório de engenharia reversa e desenvolvimento **FAW**.\n\n' +
        'Para obter acesso aos demais setores, você precisa se registrar em nossa database.\n\n' +
        '**Instruções:**\n' +
        '1️⃣ Clique no botão abaixo para iniciar.\n' +
        '2️⃣ Defina seu Nickname operacional.\n' +
        '3️⃣ Escolha se deseja a Tag de Lealdade `[FAW]` (Cor Roxa).\n\n' +
        '⚠️ *Ao prosseguir, você concorda com as diretrizes de segurança do servidor.*'
      )
      .setImage('https://i.imgur.com/uR1jWqR.png') // Banner opcional
      .setFooter({ text: 'FAW Security Protocol v4.2' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('faw_start_reg')
        .setLabel('Iniciar Registro')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️')
    );

    await channel.send({ embeds: [embed], components: [row] });
    await message.reply(`✅ Setup concluído. **${synced}** usuários sincronizados como Não-Registrados.`);
  }
};