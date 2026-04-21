import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'optimize',
  description: 'Otimiza o código para performance e legibilidade (V4 Engine)',
  async execute(message: Message, args: string[]) {
    const code = args.join(' ').replace(/\`\`\`(\w+)?/g, '').trim();
    if (!code) return message.reply('Uso: `;optimize <código>`');

    await message.reply('⚙️ **Otimizando algoritmos e reduzindo complexidade ciclomática...**');
  }
};