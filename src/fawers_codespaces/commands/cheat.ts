import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'obfuscate',
  description: 'Aplica ofuscação básica em um texto/comando',
  async execute(message: Message, args: string[]) {
    const text = args.join(' ');
    if (!text) return message.reply('Uso: `;obfuscate <texto>`');

    // Exemplo: String.fromCharCode
    const charCodes = text.split('').map(c => c.charCodeAt(0)).join(',');
    const hex = Buffer.from(text).toString('hex').match(/.{1,2}/g)?.map(h => `\\x${h}`).join('') || '';
    const b64 = Buffer.from(text).toString('base64');

    const response = `🛡️ **Técnicas de Ofuscação:**\n\n` +
      `**Base64:**\n\`\`${b64}\`\`\n\n` +
      `**Hex Escaped:**\n\`\`${hex}\`\`\n\n` +
      `**JavaScript (CharCode):**\n\`\`String.fromCharCode(${charCodes})\`\``;

    await message.reply(response);
  }
};