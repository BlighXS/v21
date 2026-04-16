import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { PermissionsBitField } from "discord.js";
import { config } from "./config.js";

export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member;
  if (!member || !("permissions" in member)) return false;
  return isAdminMember(member as GuildMember);
}

export function isAdminMember(member: GuildMember): boolean {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (config.ADMIN_ROLE_IDS.length === 0) return false;
  const roleIds = member.roles.cache.map((r) => r.id);
  return roleIds.some((id) => config.ADMIN_ROLE_IDS.includes(id));
}
