import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { PermissionsBitField } from "discord.js";
import { config } from "./config.js";

export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member;

  // evita crash em DM ou estrutura inesperada
  if (!member || !(member instanceof Object) || !("permissions" in member)) {
    return false;
  }

  return isAdminMember(member as GuildMember);
}

export function isAdminMember(member: GuildMember): boolean {
  try {
    // check direto (mais rápido e confiável)
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return true;
    }

    const adminRoles = config.ADMIN_ROLE_IDS;
    if (!adminRoles?.length) return false;

    // evita map + includes (mais lento)
    return member.roles.cache.some((role) => adminRoles.includes(role.id));
  } catch {
    // fail-safe → nunca dar admin por erro
    return false;
  }
}
