import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const prefixCommand: PrefixCommand = {
  trigger: 'modules',
  description: 'Lista todos os módulos de comando carregados',
  async execute(message: Message) {
    if (message.author.id !== '892469618063589387') return;

    try {
      const cmdPath = join(process.cwd(), 'src/fawers_codespaces/commands');
      const files = await readdir(cmdPath);
      const tsFiles = files.filter(f => f.endsWith('.ts'));

      const list = tsFiles.map(f => `• \`;${f.replace('.ts', '')}\``).join('\n');
      await message.reply(`📦 **Módulos do Codespace (${tsFiles.length}):**\n${list}`);
    } catch (err) {
      await message.reply('❌ Erro ao listar módulos.');
    }
  }
};