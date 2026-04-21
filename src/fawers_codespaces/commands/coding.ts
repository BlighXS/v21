import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'hex',
  description: 'Encode/Decode Hexadecimal',
  async execute(message: Message, args: string[]) {
    const type = args[0]?.toLowerCase();
    const text = args.slice(1).join(' ');
    if (type === 'en') return message.reply(Buffer.from(text).toString('hex'));
    if (type === 'de') return message.reply(Buffer.from(text, 'hex').toString('utf-8'));
    return message.reply('Uso: `;hex <en|de> <texto>`');
  }
};