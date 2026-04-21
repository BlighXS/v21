import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'bypass',
  description: 'Explica técnicas de bypass (WAF, 403, etc)',
  async execute(message: Message, args: string[]) {
    const response = `🛡️ **Técnicas de Bypass:**\n\n` +
      `• **403 Forbidden:** Tente cabeçalhos como \`X-Forwarded-For: 127.0.0.1\` ou mudar o path para \`/%2e/admin\`.\n` +
      `• **WAF (SQLi):** Use encodings variados (Hex, URL) ou mude palavras-chave: \`SEL/**/ECT\` em vez de \`SELECT\`.\n` +
      `• **Filtro de Extensão:** Se \`.php\` for bloqueado, tente \`.php5\`, \`.phtml\` ou \`.php.jpg\`.`;
    
    await message.reply(response);
  }
};