import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const prefixCommand: PrefixCommand = {
  trigger: 'xp',
  description: 'Verifica seu progresso no servidor',
  async execute(message: Message) {
    try {
      const DATA_PATH = join(process.cwd(), 'src/fawers_codespaces/xp_data.json');
      const content = await readFile(DATA_PATH, 'utf-8');
      const data = JSON.parse(content);
      const user = data[message.author.id] || { xp: 0, level: 1, messages: 0 };

      const nextLevelXP = user.level * 150;
      const progress = Math.floor((user.xp / nextLevelXP) * 100);

      await message.reply({
        content: `📊 **${message.author.username}**\n⭐ Nível: **${user.level}**\n✨ XP: **${user.xp} / ${nextLevelXP}** (${progress}%)\n💬 Mensagens: **${user.messages || 0}**`
      });
    } catch (err) {
      await message.reply('Você ainda não possui registros. Comece a conversar para ganhar XP!');
    }
  }
};