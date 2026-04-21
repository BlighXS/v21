import { EmbedBuilder, type Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const prefixCommand: PrefixCommand = {
  trigger: 'rank',
  description: 'Ranking de membros mais ativos',
  async execute(message: Message) {
    try {
      const DATA_PATH = join(process.cwd(), 'src/fawers_codespaces/xp_data.json');
      const data = JSON.parse(await readFile(DATA_PATH, 'utf-8'));

      const sorted = Object.entries(data)
        .map(([id, info]: [string, any]) => ({ id, ...info }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10);

      const embed = new EmbedBuilder()
        .setTitle('🏆 FAW — TOP 10 ATIVOS')
        .setColor(0x5865F2)
        .setThumbnail(message.guild?.iconURL() || null);

      let description = '';
      for (let i = 0; i < sorted.length; i++) {
        const user = await message.client.users.fetch(sorted[i].id).catch(() => ({ username: 'Desconhecido' }));
        description += `**${i + 1}.** ${user.username} — **Lvl ${sorted[i].level}** (${sorted[i].xp} XP)\n`;
      }

      embed.setDescription(description || 'Ninguém no ranking ainda.');
      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply('❌ Erro ao ler o ranking.');
    }
  }
};