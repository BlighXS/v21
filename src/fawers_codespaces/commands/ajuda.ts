import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'ajuda',
  description: 'Exibe o manual completo de operações e ferramentas',
  async execute(message: Message) {
    const helpMsg = `⚙️ **MANUAL DE OPERAÇÕES FAW - CODESPACE V4**\n\n` +
      `**🛡️ OFENSIVA (MODO REAL)**\n` +
      `\`;scan\`, \`;payload\`, \`;target\`, \`;trace\`, \`;inject\`, \`;vuln\`, \`;bypass\`, \`;break\`, \`;obfuscate\`\n\n` +
      `**🛠️ UTILITÁRIOS & REDE**\n` +
      `\`;ip\`, \`;ports\`, \`;cmd\`, \`;cheat\`, \`;process\`, \`;snip\`, \`;run\`\n\n` +
      `**🧠 DEV & IA (V4 ENGINE)**\n` +
      `\`;fix\`, \`;optimize\`, \`;doc\`, \`;regex\`, \`;lab\`, \`;mindset\`\n\n` +
      `**🔐 CRYPTO & ADMIN**\n` +
      `\`;hex\`, \`;base64\`, \`;hash\`, \`;restart\`, \`;reload\`, \`;logs\`, \`;debug\`, \`;modules\`\n\n` +
      `*Use o prefixo \`;\` antes de cada comando. Exemplo: \`;debug\`*`;
    
    await message.reply(helpMsg);
  }
};