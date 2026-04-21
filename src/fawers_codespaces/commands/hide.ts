import { PermissionsBitField, TextChannel, Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'hide',
  description: 'Privatiza o canal (esconde de @everyone) - Restrito a Fawners',
  async execute(message: Message, args: string[]) {
    const FAWNER_ROLE_ID = '1493064608154652903';
    const OWNER_ID = '892469618063589387';

    const hasRole = message.member?.roles.cache.has(FAWNER_ROLE_ID);
    const isOwner = message.author.id === OWNER_ID;
    const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!isOwner && !hasRole && !isAdmin) {
      return message.reply('❌ **Acesso Negado:** Protocolo de invisibilidade restrito ao escalão `Fawner`.');
    }

    const channel = message.channel as TextChannel;
    const action = args[0]?.toLowerCase();

    try {
      if (action === 'off' || action === 'unlock') {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
          ViewChannel: null
        });
        return message.reply('👁️ **VISIBILIDADE RESTAURADA:** O canal agora está visível para `@everyone`.');
      } else {
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
          ViewChannel: false
        });
        return message.reply('👻 **GHOST MODE:** O canal agora está oculto para `@everyone`. Apenas Fawners e Staff conseguem ver.');
      }
    } catch (err) {
      await message.reply('❌ **Erro de Permissão:** Verifique se eu tenho cargo superior para alterar visibilidade.');
    }
  }
};