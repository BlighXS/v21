import { PermissionsBitField, TextChannel, Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'clear',
  description: 'Sistema profissional de saneamento de chat (Restrito a Fawners)',
  async execute(message: Message, args: string[]) {
    const FAWNER_ROLE_ID = '1493064608154652903';
    const OWNER_ID = '892469618063589387';

    // 1. Permissões: Dono, possuidor do cargo Fawner ou permissão ManageMessages
    const hasRole = message.member?.roles.cache.has(FAWNER_ROLE_ID);
    const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages);
    const isOwner = message.author.id === OWNER_ID;

    if (!isOwner && !hasRole && !isAdmin) {
      return message.reply('❌ **Acesso Negado:** Comando restrito a membros com o cargo `Fawner` ou superior.');
    }

    const channel = message.channel as TextChannel;
    const now = Date.now();
    const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    const subCommand = args[0]?.toLowerCase();

    try {
      // MODO 1: QUANTIDADE
      if (!isNaN(Number(subCommand))) {
        let totalToClear = parseInt(subCommand);
        if (totalToClear <= 0) return message.reply('❌ Digite um número válido.');

        await message.delete().catch(() => {});
        let deletedCount = 0;

        while (totalToClear > 0) {
          const limit = Math.min(totalToClear, 100);
          const fetched = await channel.messages.fetch({ limit });
          const validMessages = fetched.filter(m => 
            (now - m.createdTimestamp) < TWENTY_FOUR_HOURS && 
            (now - m.createdTimestamp) < FOURTEEN_DAYS
          );

          if (validMessages.size === 0) break;
          const deleted = await channel.bulkDelete(validMessages, true);
          deletedCount += deleted.size;
          totalToClear -= limit;
          if (deleted.size < validMessages.size) break;
        }

        const feedback = await channel.send(deletedCount > 0 ? `🧹 **Saneamento Concluído:** ${deletedCount} mensagens removidas.` : '⚠️ Nenhuma mensagem elegível encontrada.');
        setTimeout(() => feedback.delete().catch(() => {}), 4000);
        return;
      }

      // MODO 2: INTERVALO
      if (subCommand === 'h') {
        const hours = parseFloat(args[1]);
        if (isNaN(hours) || hours <= 0 || hours > 24) return message.reply('❌ Intervalo inválido (0.1 a 24h).');

        await message.delete().catch(() => {});
        const cutoff = now - (hours * 60 * 60 * 1000);
        const fetched = await channel.messages.fetch({ limit: 100 });
        const targets = fetched.filter(m => m.createdTimestamp > cutoff && (now - m.createdTimestamp) < FOURTEEN_DAYS);

        if (targets.size === 0) return (await channel.send('⚠️ Nenhuma mensagem encontrada.')).delete().catch(() => {});
        const deleted = await channel.bulkDelete(targets, true);
        const feedback = await channel.send(`🧹 **Limpeza Temporal:** ${deleted.size} mensagens removidas.`);
        setTimeout(() => feedback.delete().catch(() => {}), 4000);
        return;
      }

      // MODO 3: JANELA HORÁRIA
      if (subCommand === 'time') {
        const timeInput = args[1]?.toLowerCase();
        if (!timeInput || !/^\d{1,2}h$/.test(timeInput)) return message.reply('❌ Use o formato 00h até 23h.');

        const hourWindow = parseInt(timeInput.replace('h', ''));
        if (hourWindow < 0 || hourWindow > 23) return message.reply('❌ Hora inválida.');

        await message.delete().catch(() => {});
        const start = new Date(); start.setHours(hourWindow, 0, 0, 0);
        const end = new Date(); end.setHours(hourWindow, 59, 59, 999);

        if (end.getTime() < (now - TWENTY_FOUR_HOURS)) return (await channel.send('❌ Limite de 24h excedido.')).delete().catch(() => {});

        const fetched = await channel.messages.fetch({ limit: 100 });
        const targets = fetched.filter(m => m.createdTimestamp >= start.getTime() && m.createdTimestamp <= end.getTime() && (now - m.createdTimestamp) < FOURTEEN_DAYS);

        if (targets.size === 0) return (await channel.send('⚠️ Janela vazia.')).delete().catch(() => {});
        const deleted = await channel.bulkDelete(targets, true);
        const feedback = await channel.send(`🧹 **Janela Saneada:** ${deleted.size} mensagens removidas.`);
        setTimeout(() => feedback.delete().catch(() => {}), 4000);
        return;
      }

      return message.reply('📚 **Clear Pro:** `;clear 10`, `;clear h 1` ou `;clear time 15h`.');
    } catch (err) {
      await message.channel.send('❌ **Erro Crítico:** Falha no processamento do BulkDelete.');
    }
  }
};