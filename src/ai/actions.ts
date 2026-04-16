import { ActivityType, ChannelType, PermissionsBitField } from "discord.js";
import type { Guild, Message } from "discord.js";
import { addBotPreference, recordMessageEvent, updateBotBiography } from "./memorial.js";

const CHANNEL_CREATOR_ROLE_ID = "1493064608154652903";
const BOT_OWNER_ID = "892469618063589387";

type FwpAction =
  | { type: "create_channel"; name?: string; kind?: "text" | "voice" | "category"; category?: string; categoryId?: string; createCategory?: boolean; reason?: string }
  | { type: "create_category"; name?: string; reason?: string }
  | { type: "move_channel"; channel?: string; channelId?: string; category?: string; categoryId?: string; createCategory?: boolean; reason?: string }
  | { type: "ban_member"; userId?: string; reason?: string }
  | { type: "kick_member"; userId?: string; reason?: string }
  | { type: "set_biography"; biography?: string }
  | { type: "remember"; content?: string };

export function stripFwpActionBlocks(text: string): string {
  return text.replace(/\[FWP_ACTION\][\s\S]*?\[\/FWP_ACTION\]/g, "").trim();
}

function extractActions(text: string): FwpAction[] {
  const actions: FwpAction[] = [];
  const regex = /\[FWP_ACTION\]([\s\S]*?)\[\/FWP_ACTION\]/g;
  for (const match of text.matchAll(regex)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as FwpAction | { actions?: FwpAction[] } | null;
      if (parsed && typeof parsed === "object" && "actions" in parsed && Array.isArray(parsed.actions)) actions.push(...parsed.actions);
      else if (parsed && typeof parsed === "object") actions.push(parsed as FwpAction);
    } catch {
      actions.push({ type: "remember", content: `A Fawers tentou emitir uma ação inválida: ${match[1].trim().slice(0, 500)}` });
    }
  }
  return actions.slice(0, 5);
}

function canCreateChannels(message: Message): boolean {
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.has(CHANNEL_CREATOR_ROLE_ID);
}

function normalizeChannelName(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 90);
  return normalized || "novo-canal";
}

function normalizeCategoryName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ").slice(0, 100);
  return normalized || "Nova Categoria";
}

function comparableName(name: string): string {
  return normalizeChannelName(name).toLowerCase();
}

async function ensureCanManageChannels(message: Message): Promise<string | null> {
  if (!message.guild) return "mensagem fora de servidor.";
  if (!canCreateChannels(message)) return `apenas usuários com o cargo <@&${CHANNEL_CREATOR_ROLE_ID}> ou administradores podem pedir isso pelo FWP.`;
  const me = message.guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return "o bot não tem permissão Gerenciar Canais.";
  return null;
}

async function findOrCreateCategory(
  guild: Guild,
  categoryName?: string,
  categoryId?: string,
  createIfMissing = true,
  reason?: string
) {
  if (categoryId) {
    const byId = guild.channels.cache.get(categoryId);
    if (byId?.type === ChannelType.GuildCategory) return byId;
  }

  if (!categoryName?.trim()) return null;

  const wanted = comparableName(categoryName);
  const existing = guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildCategory && comparableName(channel.name) === wanted
  );
  if (existing?.type === ChannelType.GuildCategory) return existing;

  if (!createIfMissing) return null;

  return guild.channels.create({
    name: normalizeCategoryName(categoryName),
    type: ChannelType.GuildCategory,
    reason
  });
}

function findChannel(guild: Guild, channelName?: string, channelId?: string) {
  if (channelId) return guild.channels.cache.get(channelId) ?? null;
  if (!channelName?.trim()) return null;
  const wanted = comparableName(channelName);
  return guild.channels.cache.find((channel) => comparableName(channel.name) === wanted) ?? null;
}

async function executeCreateCategory(message: Message, action: Extract<FwpAction, { type: "create_category" }>): Promise<string> {
  const denied = await ensureCanManageChannels(message);
  if (denied) return `Não criei categoria: ${denied}`;
  const guild = message.guild!;
  const category = await findOrCreateCategory(
    guild,
    action.name || "Nova Categoria",
    undefined,
    true,
    action.reason || `Categoria criada via FWP por ${message.author.tag}`
  );

  if (!category) return "Não consegui criar categoria: nome inválido.";

  await recordMessageEvent("ai_action", message, `Categoria criada/garantida via FWP: ${category.name} (${category.id})`, {
    action: "create_category",
    categoryId: category.id,
    requestedName: action.name
  });

  return `Categoria pronta: **${category.name}**.`;
}

async function executeCreateChannel(message: Message, action: Extract<FwpAction, { type: "create_channel" }>): Promise<string> {
  const denied = await ensureCanManageChannels(message);
  if (denied) return `Não criei canal: ${denied}`;
  const guild = message.guild!;

  const name = normalizeChannelName(action.name || "novo-canal");
  const kind = action.kind || "text";
  const type = kind === "voice" ? ChannelType.GuildVoice : kind === "category" ? ChannelType.GuildCategory : ChannelType.GuildText;
  const parent = type === ChannelType.GuildCategory
    ? null
    : await findOrCreateCategory(
        guild,
        action.category,
        action.categoryId,
        action.createCategory !== false,
        action.reason || `Categoria criada via FWP por ${message.author.tag}`
      );

  const created = await guild.channels.create({
    name,
    type,
    parent: parent?.id,
    reason: action.reason || `Criado via FWP por ${message.author.tag}`
  });

  await recordMessageEvent("ai_action", message, `Canal criado via FWP: ${created.name} (${created.id})`, {
    action: "create_channel",
    channelId: created.id,
    requestedName: action.name,
    kind,
    categoryId: parent?.id
  });

  return parent ? `Canal criado: <#${created.id}> em **${parent.name}**.` : `Canal criado: <#${created.id}>.`;
}

async function executeMoveChannel(message: Message, action: Extract<FwpAction, { type: "move_channel" }>): Promise<string> {
  const denied = await ensureCanManageChannels(message);
  if (denied) return `Não organizei canal: ${denied}`;
  const guild = message.guild!;
  const channel = findChannel(guild, action.channel, action.channelId);
  if (!channel) return `Não organizei canal: não encontrei \`${action.channelId || action.channel || "canal"}\`.`;
  if (channel.type === ChannelType.GuildCategory) return "Não organizei canal: categorias não podem ficar dentro de outra categoria.";

  const category = await findOrCreateCategory(
    guild,
    action.category,
    action.categoryId,
    action.createCategory !== false,
    action.reason || `Categoria criada via FWP por ${message.author.tag}`
  );
  if (!category) return `Não organizei canal: categoria \`${action.categoryId || action.category || "categoria"}\` não encontrada.`;

  if (!("setParent" in channel) || typeof channel.setParent !== "function") {
    return "Não organizei canal: esse tipo de canal não suporta categoria.";
  }

  await channel.setParent(category.id, { reason: action.reason || `Organizado via FWP por ${message.author.tag}` });
  await recordMessageEvent("ai_action", message, `Canal organizado via FWP: ${channel.name} (${channel.id}) -> ${category.name} (${category.id})`, {
    action: "move_channel",
    channelId: channel.id,
    categoryId: category.id
  });

  return `Canal <#${channel.id}> movido para **${category.name}**.`;
}

function canModerate(message: Message): boolean {
  const author = message.member;
  if (!author) return false;
  if (message.author.id === BOT_OWNER_ID) return true;
  return author.permissions.has(PermissionsBitField.Flags.BanMembers);
}

async function executeBanMember(message: Message, action: Extract<FwpAction, { type: "ban_member" }>): Promise<string> {
  if (!message.guild) return "Não executei ban: mensagem fora de servidor.";
  if (!canModerate(message)) return "Não executei ban: sem permissão. Só o dono ou admins podem pedir isso.";

  const me = message.guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.BanMembers)) return "Não executei ban: o bot não tem permissão de banir membros.";

  const targetId = action.userId?.replace(/[<@!>]/g, "").trim();
  if (!targetId) return "Não executei ban: ID do usuário não informado.";

  try {
    const target = await message.guild.members.fetch(targetId).catch(() => null);
    const tag = target?.user.tag ?? targetId;

    await message.guild.bans.create(targetId, {
      reason: action.reason || `Banido via FWP por ${message.author.tag}`
    });

    await recordMessageEvent("ai_action", message, `Ban executado via FWP: ${tag} (${targetId})`, {
      action: "ban_member",
      targetId,
      reason: action.reason
    });

    return `**${tag}** foi banido. Motivo: ${action.reason || "não especificado"}.`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Não consegui banir: ${msg}`;
  }
}

async function executeKickMember(message: Message, action: Extract<FwpAction, { type: "kick_member" }>): Promise<string> {
  if (!message.guild) return "Não executei kick: mensagem fora de servidor.";
  if (!canModerate(message)) return "Não executei kick: sem permissão. Só o dono ou admins podem pedir isso.";

  const me = message.guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.KickMembers)) return "Não executei kick: o bot não tem permissão de expulsar membros.";

  const targetId = action.userId?.replace(/[<@!>]/g, "").trim();
  if (!targetId) return "Não executei kick: ID do usuário não informado.";

  try {
    const target = await message.guild.members.fetch(targetId).catch(() => null);
    if (!target) return `Não executei kick: usuário \`${targetId}\` não encontrado no servidor.`;

    const tag = target.user.tag;
    await target.kick(action.reason || `Expulso via FWP por ${message.author.tag}`);

    await recordMessageEvent("ai_action", message, `Kick executado via FWP: ${tag} (${targetId})`, {
      action: "kick_member",
      targetId,
      reason: action.reason
    });

    return `**${tag}** foi expulso. Motivo: ${action.reason || "não especificado"}.`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Não consegui expulsar: ${msg}`;
  }
}

export async function executeFwpActions(message: Message, response: string): Promise<string[]> {
  const actions = extractActions(response);
  const reports: string[] = [];

  for (const action of actions) {
    try {
      if (action.type === "create_channel") {
        reports.push(await executeCreateChannel(message, action));
        continue;
      }

      if (action.type === "create_category") {
        reports.push(await executeCreateCategory(message, action));
        continue;
      }

      if (action.type === "move_channel") {
        reports.push(await executeMoveChannel(message, action));
        continue;
      }

      if (action.type === "ban_member") {
        reports.push(await executeBanMember(message, action));
        continue;
      }

      if (action.type === "kick_member") {
        reports.push(await executeKickMember(message, action));
        continue;
      }

      if (action.type === "set_biography") {
        if (!action.biography?.trim()) {
          reports.push("Biografia não alterada: conteúdo vazio.");
          continue;
        }
        await updateBotBiography(action.biography);
        await recordMessageEvent("ai_action", message, "Biografia interna atualizada via FWP.", { action: "set_biography" });
        message.client.user?.setPresence({
          activities: [{ name: action.biography.slice(0, 120), type: ActivityType.Playing }],
          status: "online"
        });
        reports.push("Biografia interna atualizada.");
        continue;
      }

      if (action.type === "remember") {
        if (!action.content?.trim()) {
          reports.push("Memória não registrada: conteúdo vazio.");
          continue;
        }
        await addBotPreference(action.content);
        await recordMessageEvent("ai_action", message, action.content, { action: "remember" });
        reports.push("Memória interna registrada.");
      }
      if (!["create_channel", "create_category", "move_channel", "ban_member", "kick_member", "set_biography", "remember"].includes(action.type)) {
        reports.push(`Ação FWP ignorada: tipo desconhecido (${String(action.type)}).`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "erro desconhecido";
      reports.push(`Ação FWP falhou: ${msg}`);
      await recordMessageEvent("ai_action", message, `Falha ao executar ação ${action.type}: ${msg}`, { action });
    }
  }

  return reports;
}