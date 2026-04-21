import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { createHash } from 'node:crypto';

export const prefixCommand: PrefixCommand = {
  trigger: 'hash',
  description: 'Gera hashes (md5, sha256)',
  async execute(message: Message, args: string[]) {
    const algo = args[0]?.toLowerCase();
    const text = args.slice(1).join(' ');
    const algos = ['md5', 'sha1', 'sha256', 'sha512'];
    if (!algos.includes(algo)) return message.reply(`Alitmos suportados: ${algos.join(', ')}`);
    const hash = createHash(algo).update(text).digest('hex');
    await message.reply(`\`\`${algo.toUpperCase()}:\`\` ${hash}`);
  }
};