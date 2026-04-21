import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'tracecode',
  description: 'Explica o código linha por linha (Human Debugger)',
  async execute(message: Message, args: string[]) {
    const code = args.join(' ').replace(/\`\`\`(\w+)?/g, '').trim();
    if (!code) return message.reply('Uso: `;tracecode <código>`');

    await message.reply('🧭 **Human Debugger Ativado:** Estou analisando o fluxo lógico e os pontos de interrupção...');
    // O core da IA assume a explicação técnica detalhada no fluxo subsequente.
  }
};