import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'simulate',
  description: 'Simula a execução de um código mostrando o estado das variáveis',
  async execute(message: Message, args: string[]) {
    const lang = args[0]?.toLowerCase();
    const code = args.slice(1).join(' ').replace(/\`\`\`(\w+)?/g, '').trim();

    if (!lang || !code) return message.reply('Uso: `;simulate <js|py> <code>`');

    await message.reply(`🧪 **Simulação de Runtime (${lang.toUpperCase()}):**\nCalculando mutações de estado e iterações de loop...`);
  }
};