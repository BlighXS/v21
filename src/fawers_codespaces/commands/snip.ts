import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SNIPS_PATH = join(process.cwd(), 'src/fawers_codespaces/snippets.json');

export const prefixCommand: PrefixCommand = {
  trigger: 'snip',
  description: 'Salva ou retorna um snippet de código',
  async execute(message: Message, args: string[]) {
    if (args.length === 0) return message.reply('Uso: `;snip <nome>` para ver ou `;snip <nome> <código>` para salvar.');

    const name = args[0].toLowerCase();
    let snips: Record<string, string> = {};

    try {
      const content = await readFile(SNIPS_PATH, 'utf-8');
      snips = JSON.parse(content);
    } catch (e) {}

    if (args.length === 1) {
      const code = snips[name];
      if (!code) return message.reply(`❌ Snippet \`${name}\` não encontrado.`);
      return message.reply(`**Snippet: ${name}**\n\`\`\`\n${code}\n\`\`\``);
    }

    const code = args.slice(1).join(' ').replace(/\`\`\`(\w+)?/g, '').trim();
    snips[name] = code;
    await writeFile(SNIPS_PATH, JSON.stringify(snips, null, 2));
    await message.reply(`✅ Snippet \`${name}\` salvo com sucesso!`);
  }
};