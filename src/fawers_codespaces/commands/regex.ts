import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'regex',
  description: 'Testa uma regex contra um texto',
  async execute(message: Message, args: string[]) {
    // Uso: ;regex /padrao/g texto
    const match = args.join(' ').match(/\/(.+)\/( [gimuy]*)?\s+(.*)/);
    if (!match) return message.reply('Uso: `;regex /padrão/flags <texto>`\nEx: `;regex /\\d+/g Teste 123`');

    const [, pattern, flags, text] = match;

    try {
      const re = new RegExp(pattern, flags || '');
      const results = [...text.matchAll(re)];
      
      if (results.length === 0) return message.reply('❌ Nenhuma correspondência encontrada.');

      const resText = results.map((m, i) => `Match ${i + 1}: \`${m[0]}\` (Posição: ${m.index})`).join('\n');
      await message.reply(`🔍 **Resultados Regex:**\n${resText.slice(0, 1900)}`);
    } catch (err: any) {
      await message.reply(`❌ Erro na Regex: ${err.message}`);
    }
  }
};