import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const prefixCommand: PrefixCommand = {
  trigger: 'force',
  description: 'Executa comandos shell ignorando travas de segurança',
  async execute(message: Message, args: string[]) {
    if (message.author.id !== '892469618063589387') return;

    const command = args.join(' ');
    if (!command) return message.reply('Uso: `;force <comando>`');

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
      const output = stdout || stderr || 'Executado (sem output).';
      await message.reply(`🔨 **FORCED EXECUTION:**\n\`\`\`\n${output.slice(0, 1900)}\n\`\`\``);
    } catch (err: any) {
      await message.reply(`❌ **Erro na Força:**\n\`\`\`\n${err.message.slice(0, 1900)}\n\`\`\``);
    }
  }
};