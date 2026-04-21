import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'mindbreak',
  description: 'Analisa código ou ideias em busca de falhas lógicas e edge cases',
  async execute(message: Message, args: string[]) {
    const input = args.join(' ').replace(/\`\`\`(\w+)?/g, '').trim();
    if (!input) return message.reply('Uso: `;mindbreak <ideia|código>`');

    await message.reply('🧠 **MindBreak Protocol:** Iniciando análise destrutiva de lógica e busca por vetores de exploração...');
    // O core da IA assume a análise técnica profunda no fluxo de resposta.
  }
};