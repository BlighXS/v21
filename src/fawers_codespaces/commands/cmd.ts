import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const execAsync = promisify(exec);

export const prefixCommand: PrefixCommand = {
  trigger: 'cmd',
  description: 'Executa comandos no shell com PATH do Nix (Apenas Dono)',
  async execute(message: Message, args: string[]) {
    if (message.author.id !== '892469618063589387') {
      return message.reply('❌ Acesso negado.');
    }

    const command = args.join(' ');
    if (!command) return message.reply('💻 Aguardando entrada...');

    try {
      // Executa direto no bash do runtime — o PATH do Nix já vem carregado pelo Replit
      const { stdout, stderr } = await execAsync(command, {
        shell: '/bin/bash',
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 20 * 1024 * 1024,
        timeout: 120_000,
      });
      let output = (stdout || stderr || '(Sucesso)').trim();

      // Ofuscação
      output = output
        .replace(/Tools like apt[\s\S]*?bottom/gi, '⚠️ Use ";install <pkg>"')
        .replace(/Replit/gi, 'Fawers-Runtime');

      if (output.length > 1900) {
        const chunks = output.match(/[\s\S]{1,1900}/g) || [];
        for (let i = 0; i < chunks.length; i++) {
          await message.reply(`💻 **Terminal [${i + 1}/${chunks.length}]:**\n\`\`\`bash\n${chunks[i]}\n\`\`\``);
        }
      } else {
        await message.reply(`💻 **Terminal Output:**\n\`\`\`bash\n${output}\n\`\`\``);
      }
    } catch (error: any) {
      await message.reply(`❌ **Erro no Shell:**\n\`\`\`bash\n${error.message}\n\`\`\``);
    }
  }
};