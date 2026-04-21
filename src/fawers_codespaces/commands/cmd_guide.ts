import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const prefixCommand: PrefixCommand = {
  trigger: 'command',
  description: 'Lista todos os comandos e suas funções (Uso: ;command list)',
  async execute(message: Message, args: string[]) {
    if (args[0] !== 'list') return message.reply('Uso correto: `;command list`');

    try {
      const cmdPath = join(process.cwd(), 'src/fawers_codespaces/commands');
      const files = await readdir(cmdPath);
      const tsFiles = files.filter(f => f.endsWith('.ts'));

      let helpText = '⚙️ **ARSENAL FAWERS - INDEXAÇÃO DINÂMICA**\n\n';

      for (const file of tsFiles) {
        const content = await readFile(join(cmdPath, file), 'utf-8');
        const triggerMatch = content.match(/trigger:\s*\'([^\']+)\'/);
        const descMatch = content.match(/description:\s*\'([^\']+)\'/);

        if (triggerMatch && descMatch) {
          helpText += `• \`;${triggerMatch[1]}\` — ${descMatch[1]}\n`;
        }
      }

      await message.reply(helpText.slice(0, 2000));
    } catch (err) {
      await message.reply('❌ Erro ao gerar lista de comandos.');
    }
  }
};