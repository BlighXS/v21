import { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'registro',
  description: 'Valida o usuário no servidor (Troca de cargo e Nick).',
  async execute(message: Message, args: string[]) {
    const MEMBER_ROLE_ID = '1493095650555068576';
    const nick = args.join(' ');

    if (!nick) return message.reply('❌ Use: `;registro SeuNick`');

    const guild = message.guild!;
    const member = message.member!;
    const unregRole = guild.roles.cache.find(r => r.name === 'Não-Registrado');
    const tagRole = guild.roles.cache.find(r => r.name === 'faw-tag');
    const memberRole = guild.roles.cache.get(MEMBER_ROLE_ID);

    try {
      // Alterar Nick
      await member.setNickname(nick).catch(() => {});

      // Troca de Cargos
      if (memberRole) await member.roles.add(memberRole);
      if (unregRole) await member.roles.remove(unregRole);

      // Verificação de Tag FAW
      if (nick.toUpperCase().includes('FAW') && tagRole) {
        await member.roles.add(tagRole);
      }

      const welcome = await message.reply(`✅ **Registro Concluído!** Bem-vindo ao laboratório FAW, **${nick}**.`);
      setTimeout(() => {
        message.delete().catch(() => {});
        welcome.delete().catch(() => {});
      }, 5000);

    } catch (err) {
      console.error(err);
      await message.reply('❌ Falha no protocolo de registro. Contate um Administrador.');
    }
  }
};