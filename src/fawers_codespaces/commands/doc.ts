import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'doc',
  description: 'Resumo técnico de linguagens ou bibliotecas',
  async execute(message: Message, args: string[]) {
    const query = args[0]?.toLowerCase();
    if (!query) return message.reply('Uso: `;doc <linguagem|lib>`');

    try {
      const res = await fetch(`https://cheat.sh/${query}?T`);
      const text = await res.text();
      const cleanText = text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      const output = cleanText.split('\n').slice(0, 25).join('\n');
      await message.reply(`📚 **Documentação Rápida: ${query}**\n\`\`\`\n${output.slice(0, 1900)}\n\`\`\``);
    } catch (e) {
      await message.reply('❌ Erro ao consultar documentação.');
    }
  }
};