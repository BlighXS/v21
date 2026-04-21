import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const execAsync = promisify(exec);

export const prefixCommand: PrefixCommand = {
  trigger: 'install',
  description: 'Instala pacotes no ambiente via Nix (Apenas Dono)',
  async execute(message: Message, args: string[]) {
    if (message.author.id !== '892469618063589387') return;

    const pkg = args[0];
    if (!pkg) return message.reply('📦 Especifique o nome do pacote Nix. Ex: `;install nmap`');

    const msg = await message.reply(`⏳ Iniciando provisionamento do pacote: **${pkg}** via Nixpkgs...`);

    try {
      // nix-env é o comando correto para ambientes Replit/Nix
      const { stdout, stderr } = await execAsync(`nix-env -iA nixpkgs.${pkg}`);
      
      await msg.edit(`✅ **Pacote instalado com sucesso!**\n\`\`\`bash\n${stdout || stderr}\n\`\`\``);
    } catch (error: any) {
      await msg.edit(`❌ **Falha na instalação:**\n\`\`\`bash\n${error.message}\n\`\`\`\nDica: Verifique o nome exato do pacote em https://search.nixos.org/packages`);
    }
  }
};