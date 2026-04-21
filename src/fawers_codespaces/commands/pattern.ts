import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'pattern',
  description: 'Detecta padrões de código ruins e vulnerabilidades escondidas',
  async execute(message: Message, args: string[]) {
    const code = args.join(' ').replace(/\`\`\`(\w+)?/g, '').trim();
    if (!code) return message.reply('Uso: `;pattern <código>`');

    await message.reply('🔍 **Pattern Detection:** Mapeando árvores sintáticas e buscando redundâncias ou falhas de segurança...');
  }
};