import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';

const execAsync = promisify(exec);

export const prefixCommand: PrefixCommand = {
  trigger: 'run',
  description: 'Executa código (js/py) no sandbox',
  async execute(message: Message, args: string[]) {
    if (message.author.id !== '892469618063589387') return;
    const lang = args[0]?.toLowerCase();
    const code = args.slice(1).join(' ').replace(/\`\`\`(\w+)?/g, '').trim();

    if (!lang || !code) return message.reply('Uso: `;run <js|py> <code>`');

    const filename = `temp_${Date.now()}.${lang === 'js' ? 'js' : 'py'}`;
    const cmd = lang === 'js' ? `node ${filename}` : `python3 ${filename}`;

    try {
      await writeFile(filename, code);
      const { stdout, stderr } = await execAsync(cmd, { timeout: 5000 });
      const output = stdout || stderr || 'Executado com sucesso (sem output).';
      await message.reply(`\`\`\`\n${output.slice(0, 1900)}\n\`\`\``);
    } catch (err: any) {
      await message.reply(`❌ Erro:\n\`\`\`\n${err.message.slice(0, 1900)}\n\`\`\``);
    } finally {
      await unlink(filename).catch(() => {});
    }
  }
};