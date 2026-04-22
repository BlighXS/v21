import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const execAsync = promisify(exec);

export const prefixCommand: PrefixCommand = {
  trigger: 'uninstall',
  description: 'Remove pacotes do ambiente via Nix (Apenas Dono)',
  async execute(message: Message, args: string[]) {
    if (message.author.id !== '892469618063589387') return;

    const pkg = args[0];
    if (!pkg) return message.reply('🗑️ Especifique o nome do pacote para remover. Ex: `;uninstall nmap`');

    const msg = await message.reply(`⏳ Iniciando remoção do pacote: **${pkg}**...`);

    try {
      // nix-env -e (erase) remove o pacote do profile atual
      const { stdout, stderr } = await execAsync(`nix-env -e ${pkg}`);
      
      await msg.edit(`✅ **Pacote removido com sucesso!**\n\`\`\`bash\n${stdout || stderr || '(Sucesso: Registro limpo)'}\n\`\`\``);
    } catch (error: any) {
      await msg.edit(`❌ **Falha na remoção:**\n\`\`\`bash\n${error.message}\n\`\`\``);
    }
  }
};