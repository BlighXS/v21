import { Message, PermissionFlagsBits } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'fwp-reset',
  description: 'Remove cargos abaixo da hierarquia Fawner de todos os membros.',
  async execute(message: Message, args: string[]) {
    if (message.author.id !== '892469618063589387') return message.reply('❌ Autoridade insuficiente.');

    const FAWNER_ROLE_ID = '1493064608154652903';
    const confirmation = args[0]?.toLowerCase();

    if (confirmation !== 'confirmar') {
      return message.reply('⚠️ **AVISO DE SEGURANÇA:** Este comando removerá os cargos de TODOS os membros abaixo da hierarquia Fawner. Digite `;fwp-reset confirmar` para prosseguir.');
    }

    const statusMsg = await message.reply('⚡ **Iniciando Reset Global...** Isso pode demorar dependendo do número de membros.');
    
    const guild = message.guild!;
    const fawnerRole = guild.roles.cache.get(FAWNER_ROLE_ID);
    if (!fawnerRole) return message.reply('❌ Cargo de referência não encontrado.');

    const members = await guild.members.fetch();
    let count = 0;

    for (const [id, member] of members) {
      if (member.user.bot) continue;
      const rolesToRemove = member.roles.cache.filter(role => 
        role.id !== guild.id && 
        role.position < fawnerRole.position
      );

      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove).catch(() => {});
        count++;
      }
    }

    await statusMsg.edit(`✅ **Reset Concluído:** Cargos removidos de ${count} membros.`);
  }
};