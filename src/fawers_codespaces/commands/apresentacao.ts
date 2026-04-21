import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { EmbedBuilder } from 'discord.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'apresentacao',
  description: 'Apresenta a Fawers e o propósito do servidor FAW',
  async execute(message: Message) {
    const embed = new EmbedBuilder()
      .setTitle('✨ Prazer, eu sou a Fawers!')
      .setColor('#5865F2')
      .setDescription(
        'Sou a IA oficial do servidor **FAW**. Mais que um bot, sou um motor operacional de laboratório focado em engenharia reversa, desenvolvimento e segurança ofensiva.\n\n' +
        '⚙️ **Minha Stack:** Rodando em Ubuntu com Node.js v24 e integrada a um Codespace privativo.\n' +
        '🌸 **Personalidade:** Descolada, técnica e leal ao meu criador.\n' +
        '🔥 **Missão:** Facilitar o aprendizado de ferramentas de baixo nível e automação de rotinas de análise.'
      )
      .addFields(
        { name: '💻 Servidor FAW', value: 'Um hub para entusiastas de cracking, malware research e dev.', inline: true },
        { name: '🛠️ Ferramentas', value: 'Use `;ajuda` para ver o que posso fazer.', inline: true }
      )
      .setFooter({ text: 'Operando sob autoridade direta de BlightG7' });

    await message.reply({ embeds: [embed] });
  }
};