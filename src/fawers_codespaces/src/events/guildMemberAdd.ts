import { Events, GuildMember } from 'discord.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    const UNREG_ROLE_ID = '1495985456943202327';
    const MEMBER_ROLE_ID = '1493095650555068576';

    try {
      // Se não tem o cargo de membro, ganha o de não-registrado
      if (!member.roles.cache.has(MEMBER_ROLE_ID)) {
        await member.roles.add(UNREG_ROLE_ID).catch(() => {});
      }
    } catch (err) {
      console.error('Erro ao atribuir cargo inicial:', err);
    }
  }
};