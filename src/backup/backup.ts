import type {
  ButtonInteraction,
  Guild,
  GuildBasedChannel,
  GuildChannel,
  Message,
  StringSelectMenuInteraction,
  PermissionOverwrite,
  Role
} from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  StringSelectMenuBuilder
} from "discord.js";
import { buildEmbed } from "../utils/format.js";
import { isAdminMember } from "../utils/permissions.js";
import {
  loadBackupFile,
  loadBackupIndex,
  saveBackupFile,
  saveBackupIndex,
  type BackupMeta
} from "./store.js";

const BACKUP_PREFIX = "backup";

interface BackupRole {
  name: string;
  color: number;
  permissions: string;
  hoist: boolean;
  mentionable: boolean;
  position: number;
}

interface BackupOverwrite {
  id: string;
  type: "role" | "member";
  allow: string;
  deny: string;
  name?: string;
}

interface BackupChannel {
  name: string;
  type: ChannelType;
  parent: string | null;
  position: number;
  topic?: string | null;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  bitrate?: number | null;
  userLimit?: number | null;
  permissionOverwrites: BackupOverwrite[];
}

export interface GuildBackup {
  guildId: string;
  guildName: string;
  createdAt: string;
  roles: BackupRole[];
  channels: BackupChannel[];
}

function buildIntroEmbed() {
  const lines = [
    "Backup do servidor: salva cargos e canais exatamente como estao.",
    "Use `;backup server <nome>` para criar.",
    "Use `;backup list` para listar backups.",
    "Use `;backup restore` para restaurar uma versao."
  ].join("\n");
  return buildEmbed("Backup do Servidor", lines, "info");
}

function buildConfirmEmbed(name: string) {
  const lines = [
    `Voce esta prestes a restaurar o backup **${name}**.`,
    "Isso pode remover canais/cargos que nao existiam nesse backup.",
    "Deseja continuar?"
  ].join("\n");
  return buildEmbed("Confirmar restauracao", lines, "warn");
}

function buildButtonsRow(id: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BACKUP_PREFIX}:confirm:${id}`)
      .setLabel("Restaurar")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${BACKUP_PREFIX}:cancel:${id}`)
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildSelectRow(backups: BackupMeta[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${BACKUP_PREFIX}:select`)
    .setPlaceholder("Escolha um backup")
    .addOptions(
      backups.slice(0, 25).map((b) => ({
        label: b.name,
        value: b.id,
        description: new Date(b.createdAt).toLocaleString("pt-BR")
      }))
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function buildList(backups: BackupMeta[]): string {
  return backups
    .slice(0, 20)
    .map((b, idx) => `${idx + 1}. ${b.name} — ${new Date(b.createdAt).toLocaleString("pt-BR")}`)
    .join("\n");
}

function normalizeOverwrite(guild: Guild, overwrite: PermissionOverwrite): BackupOverwrite {
  const roleName =
    overwrite.type === 0 ? guild.roles.cache.get(overwrite.id)?.name ?? undefined : undefined;
  return {
    id: overwrite.id,
    type: overwrite.type === 0 ? "role" : "member",
    allow: overwrite.allow.bitfield.toString(),
    deny: overwrite.deny.bitfield.toString(),
    name: roleName
  };
}

function isRestorableChannel(channel: GuildBasedChannel): channel is GuildChannel {
  return (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildVoice ||
    channel.type === ChannelType.GuildCategory ||
    channel.type === ChannelType.GuildForum
  );
}

function snapshotRole(role: Role): BackupRole | null {
  if (role.managed) return null;
  if (role.name === "@everyone") return null;
  return {
    name: role.name,
    color: role.color,
    permissions: role.permissions.bitfield.toString(),
    hoist: role.hoist,
    mentionable: role.mentionable,
    position: role.position
  };
}

function snapshotChannel(channel: GuildChannel): BackupChannel {
  return {
    name: channel.name,
    type: channel.type,
    parent: channel.parent?.name ?? null,
    position: channel.rawPosition,
    topic: "topic" in channel ? channel.topic ?? null : null,
    nsfw: "nsfw" in channel ? channel.nsfw : undefined,
    rateLimitPerUser: "rateLimitPerUser" in channel ? channel.rateLimitPerUser : undefined,
    bitrate: "bitrate" in channel ? channel.bitrate : undefined,
    userLimit: "userLimit" in channel ? channel.userLimit : undefined,
    permissionOverwrites: channel.permissionOverwrites.cache.map((o) =>
      normalizeOverwrite(channel.guild, o)
    )
  };
}

export async function createBackup(guild: Guild, name: string): Promise<BackupMeta> {
  const roles = guild.roles.cache
    .map(snapshotRole)
    .filter((r): r is BackupRole => r !== null)
    .sort((a, b) => a.position - b.position);

  const channels = guild.channels.cache
    .filter(isRestorableChannel)
    .map(snapshotChannel)
    .sort((a, b) => a.position - b.position);

  const payload: GuildBackup = {
    guildId: guild.id,
    guildName: guild.name,
    createdAt: new Date().toISOString(),
    roles,
    channels
  };

  const id = `${Date.now()}`;
  const file = await saveBackupFile(id, payload);

  const index = await loadBackupIndex();
  const meta: BackupMeta = { id, name, createdAt: payload.createdAt, file };
  index.backups.unshift(meta);
  await saveBackupIndex(index);

  return meta;
}

function findCategoryByName(guild: Guild, name: string) {
  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === name
  );
}

async function applyRoles(guild: Guild, roles: BackupRole[]) {
  const existing = guild.roles.cache.filter((r) => !r.managed && r.name !== "@everyone");

  const desiredNames = new Set(roles.map((r) => r.name));
  for (const role of existing.values()) {
    if (!desiredNames.has(role.name)) {
      try { await role.delete("Restauracao de backup"); } catch { /* ignore */ }
    }
  }

  const createdOrExisting: Role[] = [];
  for (const role of roles) {
    const found = existing.find((r) => r.name === role.name);
    if (found) {
      await found.edit({
        color: role.color,
        permissions: BigInt(role.permissions),
        hoist: role.hoist,
        mentionable: role.mentionable
      });
      createdOrExisting.push(found);
    } else {
      const created = await guild.roles.create({
        name: role.name,
        color: role.color,
        permissions: BigInt(role.permissions),
        hoist: role.hoist,
        mentionable: role.mentionable,
        reason: "Restauracao de backup"
      });
      createdOrExisting.push(created);
    }
  }

  const sorted = roles.slice().sort((a, b) => a.position - b.position);
  const positions = sorted.map((r) => {
    const role = createdOrExisting.find((x) => x.name === r.name);
    if (!role) return null;
    return { id: role.id, position: r.position };
  }).filter(Boolean) as { id: string; position: number }[];

  if (positions.length) {
    await guild.roles.setPositions(positions);
  }
}

async function applyChannels(guild: Guild, channels: BackupChannel[]) {
  const desired = new Set(channels.map((c) => `${c.parent ?? "root"}:${c.name}:${c.type}`));

  for (const channel of guild.channels.cache.values()) {
    if (!isRestorableChannel(channel)) continue;
    const key = `${channel.parent?.name ?? "root"}:${channel.name}:${channel.type}`;
    if (!desired.has(key)) {
      try { await channel.delete("Restauracao de backup"); } catch { /* ignore */ }
    }
  }

  const categories = channels.filter((c) => c.type === ChannelType.GuildCategory);
  for (const cat of categories) {
    const existing = findCategoryByName(guild, cat.name);
    if (!existing) {
      await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory
      });
    }
  }

  for (const channel of channels) {
    if (channel.type === ChannelType.GuildCategory) continue;
    const parent = channel.parent ? findCategoryByName(guild, channel.parent) : null;
    const existing = guild.channels.cache.find(
      (c) => c.name === channel.name && c.type === channel.type && c.parent?.name === channel.parent
    );

    if (!existing) {
      await guild.channels.create({
        name: channel.name,
        type: channel.type,
        parent: parent?.id ?? null,
        topic: channel.topic ?? undefined,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.rateLimitPerUser,
        bitrate: channel.bitrate ?? undefined,
        userLimit: channel.userLimit ?? undefined
      });
    } else {
      await existing.edit({
        parent: parent?.id ?? null,
        topic: channel.topic ?? undefined,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.rateLimitPerUser,
        bitrate: channel.bitrate ?? undefined,
        userLimit: channel.userLimit ?? undefined
      });
    }
  }

  for (const channel of channels) {
    const parent = channel.parent ? findCategoryByName(guild, channel.parent) : null;
    const target = guild.channels.cache.find(
      (c) => c.name === channel.name && c.type === channel.type && c.parent?.name === channel.parent
    );
    if (!target) continue;

    const overwrites = channel.permissionOverwrites.map((o) => {
      let targetId = o.id;
      if (o.type === "role" && o.name) {
        const role = guild.roles.cache.find((r) => r.name === o.name);
        if (role) targetId = role.id;
      }
      return {
        id: targetId,
        type: o.type === "role" ? 0 : 1,
        allow: BigInt(o.allow),
        deny: BigInt(o.deny)
      };
    });

    await target.permissionOverwrites.set(overwrites);
    await target.setPosition(channel.position).catch(() => undefined);

    if (parent && target.parentId !== parent.id) {
      await target.setParent(parent.id);
    }
  }
}

async function restoreBackup(guild: Guild, backup: GuildBackup) {
  await applyRoles(guild, backup.roles);
  await applyChannels(guild, backup.channels);
}

export async function handleBackupCommand(message: Message, args: string[]) {
  if (!message.guild) return;
  if (!message.member || !isAdminMember(message.member)) {
    const embed = buildEmbed("Acesso negado", "Sem permissao para este comando.", "warn");
    await message.reply({ embeds: [embed] });
    return;
  }

  if (args.length === 0) {
    const embed = buildIntroEmbed();
    await message.reply({ embeds: [embed] });
    return;
  }

  const sub = args.shift()?.toLowerCase();
  if (sub === "server") {
    const name = args.join(" ").trim();
    if (!name) {
      const embed = buildEmbed("Uso correto", "Uso: `;backup server <nome>`", "info");
      await message.reply({ embeds: [embed] });
      return;
    }

    const meta = await createBackup(message.guild, name);
    const embed = buildEmbed(
      "Backup criado",
      `Backup **${meta.name}** criado em ${new Date(meta.createdAt).toLocaleString("pt-BR")}.
Use ";backup restore" para restaurar.`,
      "ok"
    );
    await message.reply({ embeds: [embed] });
    return;
  }

  if (sub === "list") {
    const index = await loadBackupIndex();
    if (index.backups.length === 0) {
      const embed = buildEmbed("Sem backups", "Nenhum backup encontrado.", "info");
      await message.reply({ embeds: [embed] });
      return;
    }

    const list = buildList(index.backups);
    const embed = buildEmbed("Backups disponíveis", list, "info");
    await message.reply({ embeds: [embed] });
    return;
  }

  if (sub === "restore") {
    const index = await loadBackupIndex();
    if (index.backups.length === 0) {
      const embed = buildEmbed("Sem backups", "Nenhum backup encontrado.", "info");
      await message.reply({ embeds: [embed] });
      return;
    }

    const embed = buildEmbed("Restaurar backup", "Selecione um backup para restaurar.", "info");
    const row = buildSelectRow(index.backups);
    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  const embed = buildEmbed("Uso correto", "Use `;backup server <nome>` ou `;backup restore`.", "info");
  await message.reply({ embeds: [embed] });
}

export async function handleBackupSelect(interaction: StringSelectMenuInteraction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (interaction.customId !== `${BACKUP_PREFIX}:select`) return false;

  if (!interaction.guild) {
    await interaction.reply({ content: "Comando disponivel apenas em servidor.", ephemeral: true });
    return true;
  }

  const [id] = interaction.values;
  const index = await loadBackupIndex();
  const backup = index.backups.find((b) => b.id === id);
  if (!backup) {
    await interaction.reply({ content: "Backup nao encontrado.", ephemeral: true });
    return true;
  }

  const embed = buildConfirmEmbed(backup.name);
  const row = buildButtonsRow(backup.id);
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  return true;
}

export async function handleBackupButton(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith(`${BACKUP_PREFIX}:`)) return false;

  if (!interaction.guild) {
    await interaction.reply({ content: "Comando disponivel apenas em servidor.", ephemeral: true });
    return true;
  }

  if (!interaction.member || !("permissions" in interaction.member)) {
    await interaction.reply({ content: "Permissao insuficiente.", ephemeral: true });
    return true;
  }

  const memberPerms = interaction.member.permissions;
  if (!memberPerms.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: "Permissao insuficiente.", ephemeral: true });
    return true;
  }

  const [, action, id] = interaction.customId.split(":");

  if (action === "cancel") {
    const embed = buildEmbed("Restauracao cancelada", "Sem alteracoes realizadas.", "info");
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (action === "confirm") {
    const index = await loadBackupIndex();
    const meta = index.backups.find((b) => b.id === id);
    if (!meta) {
      await interaction.reply({ content: "Backup nao encontrado.", ephemeral: true });
      return true;
    }

    const backup = await loadBackupFile<GuildBackup>(meta.file);
    if (backup.guildId !== interaction.guild.id) {
      await interaction.followUp({
        content: "Este backup pertence a outro servidor.",
        ephemeral: true
      });
      return true;
    }
    const embed = buildEmbed("Restaurando", "Aplicando backup...", "action");
    await interaction.reply({ embeds: [embed], ephemeral: true });

    try {
      await restoreBackup(interaction.guild, backup);
      const done = buildEmbed("Restauracao concluida", `Backup **${meta.name}** aplicado.`, "ok");
      await interaction.followUp({ embeds: [done], ephemeral: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      const fail = buildEmbed("Falha na restauracao", msg, "error");
      await interaction.followUp({ embeds: [fail], ephemeral: true });
    }

    return true;
  }

  return false;
}
