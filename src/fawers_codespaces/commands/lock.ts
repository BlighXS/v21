import { PermissionsBitField, TextChannel, Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'lock',
  description: 'Bloqueia o chat para @everyone (mas mantêm visível) - Restrito a Fawners',
  async execute(message: Message, args: string[]) {
    const FAWNER_ROLE_ID = '1493064608154652903';
    const OWNER_ID = '892469618063589387';

    const hasRole = message.member?.roles.cache.has(FAWNER_ROLE_ID);
    const isOwner = message.author.id === OWNER_ID;
    const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!isOwner && !hasRole && !isAdmin) {
      return message.reply('❌ **Acesso Negado:** Protocolo de bloqueio restrito ao escalão `Fawner`.');
    }

    const channel = message.channel as TextChannel;
    const action = args[0]?.toLowerCase();

    try {
      if (action === 'off' || action === 'unlock') {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
          SendMessages: null
        });
        return message.reply('🔓 **CHAT LIBERADO:** Escrita restaurada para `@everyone`.');
      } else {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
          SendMessages: false
        });
        return message.reply('🔒 **CHAT TRANCADO:** Escrita desativada para `@everyone`. Use `;lock off` para liberar.');
      }
    } catch (err) {
      await message.reply('❌ **Falha de Operação:** Não foi possível alterar as permissões de escrita.');
    }
  }
};