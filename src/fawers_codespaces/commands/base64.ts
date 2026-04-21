import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'base64',
  description: 'Encode/Decode Base64',
  async execute(message: Message, args: string[]) {
    const type = args[0]?.toLowerCase();
    const text = args.slice(1).join(' ');
    if (type === 'en') return message.reply(Buffer.from(text).toString('base64'));
    if (type === 'de') return message.reply(Buffer.from(text, 'base64').toString('utf-8'));
    return message.reply('Uso: `;base64 <en|de> <texto>`');
  }
};