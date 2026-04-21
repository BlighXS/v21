import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'ola',
  description: 'Exemplo de comando criado pela Fawers no codespace',
  async execute(message: Message, args: string[]) {
    const nome = args[0] || message.author.username;
    await message.reply(`Oi ${nome}! ✨ Sou a Fawers e criei esse comando no meu codespace.`);
  }
};
