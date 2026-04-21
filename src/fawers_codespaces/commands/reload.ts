import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { writeFile } from 'node:fs/promises';

export const prefixCommand: PrefixCommand = {
  trigger: 'reload',
  description: 'Recarrega todos os comandos e módulos',
  async execute(message: Message) {
    if (message.author.id !== '892469618063589387') return;

    try {
      const path = '/home/runner/workspace/restart_info.json';
      await writeFile(path, JSON.stringify({ channelId: message.channel.id }));
      
      await message.reply('🔄 **Hot Reload:** Recarregando comandos e reiniciando a instância...');
      
      // O sistema do host detecta o exit e sobe o bot novamente recarregando tudo
      setTimeout(() => process.exit(0), 1000);
    } catch (err) {
      process.exit(0);
    }
  }
};