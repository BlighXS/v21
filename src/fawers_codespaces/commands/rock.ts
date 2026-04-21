import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'rock',
  description: 'Responde "and roll!" quando alguém usa o comando.',
  async execute(message: Message) {
    await message.reply('and roll!');
  }
};
