import { ActivityType, AttachmentBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { Guild, Message } from "discord.js";
import { addBotPreference, recordMessageEvent, recordMemorialEvent, updateBotBiography } from "./memorial.js";
import { readSourceFile, writeSourceFile, listSourceFiles } from "../utils/sysinfo.js";
import { generateImage } from "./imageGen.js";
import { createPendingWrite } from "./pendingWrites.js";
import { config } from "../utils/config.js";
import { safeFetch } from "../utils/net.js";
import dns from "node:dns/promises";
import { csShellExec, csWriteFile, csReadFile, csListFiles, csSendFile, aiFetch, csReloadCommands } from "./codespace.js";

const CHANNEL_CREATOR_ROLE_ID = "1493064608154652903";
const BOT_OWNER_ID = "892469618063589387";

type FwpAction =
  | { type: "create_channel"; name?: string; kind?: "text" | "voice" | "category"; category?: string; categoryId?: string; createCategory?: boolean; reason?: string }
  | { type: "create_category"; name?: string; reason?: string }
  | { type: "move_channel"; channel?: string; channelId?: string; category?: string; categoryId?: string; createCategory?: boolean; reason?: string }
  | { type: "ban_member"; userId?: string; reason?: string }
  | { type: "kick_member"; userId?: string; reason?: string }
  | { type: "set_biography"; biography?: string }
  | { type: "remember"; content?: string }
  | { type: "read_source_file"; path?: string; fromLine?: number; toLine?: number }
  | { type: "write_source_file"; path?: string; content?: string }
  | { type: "list_source_files"; dir?: string }
  | { type: "generate_image"; prompt?: string; imageUrl?: string }
  | { type: "mute_member"; userId?: string; durationMinutes?: number; reason?: string }
  | { type: "send_message"; channelId?: string; channel?: string; userId?: string; content?: string }
  | { type: "restart_self"; reason?: string }
  | { type: "fetch_url"; url?: string; maxChars?: number }
  | { type: "dns_lookup"; host?: string }
  | { type: "shell_exec"; command?: string }
  | { type: "cs_write_file"; path?: string; content?: string }
  | { type: "cs_read_file"; path?: string }
  | { type: "cs_list_files"; dir?: string }
  | { type: "cs_send_file"; path?: string }
  | { type: "cs_reload_commands" }
  | { type: "create_role"; name?: string; color?: string | number; hoist?: boolean; mentionable?: boolean; permissions?: string[]; reason?: string }
  | { type: "edit_role"; roleId?: string; role?: string; name?: string; color?: string | number; hoist?: boolean; mentionable?: boolean; permissions?: string[]; reason?: string }
  | { type: "delete_role"; roleId?: string; role?: string; reason?: string }
  | { type: "assign_role"; userId?: string; roleId?: string; role?: string; reason?: string }
  | { type: "remove_role"; userId?: string; roleId?: string; role?: string; reason?: string }
  | { type: "rename_channel"; channelId?: string; channel?: string; newName?: string; topic?: string; reason?: string }
  | { type: "delete_channel"; channelId?: string; channel?: string; reason?: string }
  | { type: "delete_category"; categoryId?: string; category?: string; deleteChildren?: boolean; reason?: string }
  | { type: "set_nickname"; userId?: string; nickname?: string; reason?: string }
  | { type: "unban_member"; userId?: string; reason?: string }
  | { type: "pin_message"; channelId?: string; channel?: string; messageId?: string; reason?: string }
  | { type: "delete_message"; channelId?: string; channel?: string; messageId?: string; reason?: string }
  | { type: "set_channel_permissions"; channelId?: string; channel?: string; targetType?: "role" | "member"; targetId?: string; target?: string; allow?: string[]; deny?: string[]; clear?: string[]; reason?: string };

export function stripFwpActionBlocks(text: string): string {
  return text
    .replace(/\[FWP_ACTION\][\s\S]*?\[\/FWP_ACTION\]/g, "")
    .replace(/\[FWP_WRITE_FILE\][\s\S]*?\[\/FWP_WRITE_FILE\]/g, "")
    .trim();
}

export interface FwpFileRead {
  path: string;
  content: string;
}

export interface FwpExecutionResult {
  reports: string[];
  fileReads: FwpFileRead[];
  memoryNotes: string[];
}

/**
 * Extrai blocos FWP_WRITE_FILE — formato especial que não requer JSON-escaping do código.
 * Formato:
 *   [FWP_WRITE_FILE]
 *   path: src/commands/rank.ts
 *   ---
 *   ...conteúdo completo do arquivo TypeScript...
 *   [/FWP_WRITE_FILE]
 */
function extractWriteFileBlocks(text: string): FwpAction[] {
  const actions: FwpAction[] = [];
  const regex = /\[FWP_WRITE_FILE\]([\s\S]*?)\[\/FWP_WRITE_FILE\]/g;
  for (const match of text.matchAll(regex)) {
    const raw = match[1];
    const separatorIdx = raw.indexOf("---");
    if (separatorIdx === -1) continue;
    const header = raw.slice(0, separatorIdx).trim();
    const content = raw.slice(separatorIdx + 3);
    // Strip optional leading newline after ---
    const fileContent = content.startsWith("\n") ? content.slice(1) : content;
    // Parse "path: src/..."
    const pathMatch = header.match(/^path:\s*(.+)$/m);
    if (!pathMatch) continue;
    const filePath = pathMatch[1].trim();
    actions.push({ type: "write_source_file", path: filePath, content: fileContent });
  }
  return actions;
}

function extractActions(text: string): FwpAction[] {
  const actions: FwpAction[] = [];

  // Parse standard JSON-based FWP_ACTION blocks
  const regex = /\[FWP_ACTION\]([\s\S]*?)\[\/FWP_ACTION\]/g;
  for (const match of text.matchAll(regex)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as FwpAction | { actions?: FwpAction[] } | null;
      if (parsed && typeof parsed === "object" && "actions" in parsed && Array.isArray(parsed.actions)) actions.push(...parsed.actions);
      else if (parsed && typeof parsed === "object") actions.push(parsed as FwpAction);
    } catch {
      // Try to salvage write_source_file with malformed JSON by extracting path and content manually
      const raw = match[1].trim();
      const typeMatch = raw.match(/"type"\s*:\s*"write_source_file"/);
      const pathMatch = raw.match(/"path"\s*:\s*"([^"]+)"/);
      if (typeMatch && pathMatch) {
        // Extract content between the first occurrence of "content": " and the last "
        const contentStart = raw.indexOf('"content"');
        if (contentStart !== -1) {
          const afterKey = raw.slice(contentStart + 9).trimStart().slice(1); // skip ":"
          const firstQuote = afterKey.indexOf('"');
          if (firstQuote !== -1) {
            const contentRaw = afterKey.slice(firstQuote + 1);
            // Take everything up to the last " before } or end
            const lastQuote = contentRaw.lastIndexOf('"');
            if (lastQuote !== -1) {
              const content = contentRaw.slice(0, lastQuote).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
              actions.push({ type: "write_source_file", path: pathMatch[1], content });
            }
          }
        }
      } else {
        actions.push({ type: "remember", content: `A Fawers tentou emitir uma ação inválida: ${raw.slice(0, 500)}` });
      }
    }
  }

  // Parse FWP_WRITE_FILE blocks (no JSON escaping needed — preferred for code)
  actions.push(...extractWriteFileBlocks(text));

  return actions;
}

function getTargetGuild(message: Message) {
  if (message.guild) return message.guild;
  const byConfig = config.DISCORD_GUILD_ID ? message.client.guilds.cache.get(config.DISCORD_GUILD_ID) : undefined;
  return byConfig ?? message.client.guilds.cache.first() ?? null;
}

function canCreateChannels(message: Message): boolean {
  if (message.author.id === BOT_OWNER_ID) return true;
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

async function ensureCanManageChannels(message: Message): Promise<{ error: string } | { guild: Guild }> {
  const guild = getTargetGuild(message);
  if (!guild) return { error: "nenhum servidor encontrado." };
  if (!canCreateChannels(message)) return { error: `apenas usuários com o cargo <@&${CHANNEL_CREATOR_ROLE_ID}> ou administradores podem pedir isso pelo FWP.` };
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return { error: "o bot não tem permissão Gerenciar Canais." };
  return { guild };
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
  const check = await ensureCanManageChannels(message);
  if ("error" in check) return `Não criei categoria: ${check.error}`;
  const guild = check.guild;
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
  const check = await ensureCanManageChannels(message);
  if ("error" in check) return `Não criei canal: ${check.error}`;
  const guild = check.guild;

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
  const check = await ensureCanManageChannels(message);
  if ("error" in check) return `Não organizei canal: ${check.error}`;
  const guild = check.guild;
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
  if (message.author.id === BOT_OWNER_ID) return true;
  const author = message.member;
  if (!author) return false;
  return author.permissions.has(PermissionsBitField.Flags.BanMembers);
}

async function executeBanMember(message: Message, action: Extract<FwpAction, { type: "ban_member" }>): Promise<string> {
  const guild = getTargetGuild(message);
  if (!guild) return "Não executei ban: nenhum servidor encontrado.";
  if (!canModerate(message)) return "Não executei ban: sem permissão. Só o dono ou admins podem pedir isso.";

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.BanMembers)) return "Não executei ban: o bot não tem permissão de banir membros.";

  const rawId = action.userId?.replace(/[<@!>]/g, "").trim();
  const targetId = rawId || message.mentions.users.filter(u => u.id !== message.client.user?.id).first()?.id;
  if (!targetId) return "Não executei ban: nenhum usuário mencionado ou ID informado.";

  try {
    const target = await guild.members.fetch(targetId).catch(() => null);
    const tag = target?.user.tag ?? targetId;

    await guild.bans.create(targetId, {
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
  const guild = getTargetGuild(message);
  if (!guild) return "Não executei kick: nenhum servidor encontrado.";
  if (!canModerate(message)) return "Não executei kick: sem permissão. Só o dono ou admins podem pedir isso.";

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.KickMembers)) return "Não executei kick: o bot não tem permissão de expulsar membros.";

  const rawId = action.userId?.replace(/[<@!>]/g, "").trim();
  const targetId = rawId || message.mentions.users.filter(u => u.id !== message.client.user?.id).first()?.id;
  if (!targetId) return "Não executei kick: nenhum usuário mencionado ou ID informado.";

  try {
    const target = await guild.members.fetch(targetId).catch(() => null);
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

async function executeFetchUrl(_message: Message, action: Extract<FwpAction, { type: "fetch_url" }>): Promise<string> {
  if (!action.url?.trim()) return "fetch_url: nenhuma URL fornecida.";
  try {
    const content = await aiFetch(action.url.trim(), action.maxChars ?? 8000);
    return `[Conteúdo de ${action.url}]\n\`\`\`\n${content}\n\`\`\``;
  } catch (err) {
    return `fetch_url falhou para ${action.url}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeDnsLookup(_message: Message, action: Extract<FwpAction, { type: "dns_lookup" }>): Promise<string> {
  if (!action.host?.trim()) return "dns_lookup: nenhum host fornecido.";
  const host = action.host.trim().replace(/^https?:\/\//, "").split("/")[0];
  const results: string[] = [`[DNS Lookup: ${host}]`];
  try {
    const a = await dns.resolve4(host).catch(() => [] as string[]);
    const aaaa = await dns.resolve6(host).catch(() => [] as string[]);
    const mx = await dns.resolveMx(host).catch(() => [] as { priority: number; exchange: string }[]);
    const ns = await dns.resolveNs(host).catch(() => [] as string[]);
    const txt = await dns.resolveTxt(host).catch(() => [] as string[][]);
    const cname = await dns.resolveCname(host).catch(() => [] as string[]);
    if (a.length) results.push(`A: ${a.join(", ")}`);
    if (aaaa.length) results.push(`AAAA: ${aaaa.join(", ")}`);
    if (cname.length) results.push(`CNAME: ${cname.join(", ")}`);
    if (ns.length) results.push(`NS: ${ns.join(", ")}`);
    if (mx.length) results.push(`MX: ${mx.map(r => `${r.priority} ${r.exchange}`).join(", ")}`);
    if (txt.length) results.push(`TXT: ${txt.map(r => r.join("")).join(" | ")}`);
    if (results.length === 1) results.push("Nenhum registro encontrado.");
  } catch (err) {
    results.push(`Erro: ${err instanceof Error ? err.message : String(err)}`);
  }
  return results.join("\n");
}

async function executeShellExec(message: Message, action: Extract<FwpAction, { type: "shell_exec" }>): Promise<string> {
  const command = action.command?.trim();
  if (!command) return "shell_exec: nenhum comando fornecido.";
  await recordMessageEvent("ai_action", message, `Shell exec no codespace: ${command.slice(0, 300)}`, { action: "shell_exec", command });
  const output = await csShellExec(command);
  return `\`\`\`\n$ ${command}\n${output}\n\`\`\``;
}

async function executeCsWriteFile(_message: Message, action: Extract<FwpAction, { type: "cs_write_file" }>): Promise<string> {
  if (!action.path?.trim()) return "cs_write_file: path não fornecido.";
  if (action.content === undefined) return "cs_write_file: content não fornecido.";
  return csWriteFile(action.path.trim(), action.content);
}

async function executeCsReadFile(_message: Message, action: Extract<FwpAction, { type: "cs_read_file" }>): Promise<string> {
  if (!action.path?.trim()) return "cs_read_file: path não fornecido.";
  return csReadFile(action.path.trim());
}

async function executeCsListFiles(_message: Message, action: Extract<FwpAction, { type: "cs_list_files" }>): Promise<string> {
  return csListFiles(action.dir?.trim() || ".");
}

async function executeCsSendFile(message: Message, action: Extract<FwpAction, { type: "cs_send_file" }>): Promise<string> {
  if (!action.path?.trim()) return "cs_send_file: path não fornecido.";
  return csSendFile(message, action.path.trim());
}

async function executeReadSourceFile(
  _message: Message,
  action: Extract<FwpAction, { type: "read_source_file" }>,
  pendingReads: FwpFileRead[]
): Promise<string> {
  if (!action.path?.trim()) return "read_source_file: path não fornecido.";
  try {
    const content = await readSourceFile(action.path.trim(), action.fromLine, action.toLine);
    pendingReads.push({ path: action.path.trim(), content });
    return `Lido (modo só-leitura): \`${action.path.trim()}\` — ${content.length} caracteres carregados no contexto da IA.`;
  } catch (err) {
    return `read_source_file: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeWriteSourceFile(_message: Message, _action: Extract<FwpAction, { type: "write_source_file" }>): Promise<string> {
  return "❌ Escrita no código-fonte do bot está BLOQUEADA. Você só pode editar arquivos dentro de `src/fawers_codespaces/` via `cs_write_file`. Para sugerir mudanças no código principal, descreva-as ao dono — ele aplica.";
}

async function executeListSourceFiles(_message: Message, action: Extract<FwpAction, { type: "list_source_files" }>): Promise<string> {
  try {
    const dir = action.dir?.trim() || ".";
    const files = await listSourceFiles(dir);
    const out = files.join("\n");
    return `[Arquivos em ${dir} — ${files.length} entradas]\n\`\`\`\n${out || "(vazio)"}\n\`\`\``;
  } catch (err) {
    return `list_source_files: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// =================== ROLES ===================

function parseColor(input?: string | number): number | undefined {
  if (input == null) return undefined;
  if (typeof input === "number") return input;
  const s = String(input).trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(s)) return parseInt(s, 16);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return undefined;
}

function parsePermissions(perms?: string[]): bigint | undefined {
  if (!perms || perms.length === 0) return undefined;
  let bits = 0n;
  for (const p of perms) {
    const key = p.trim();
    if (!key) continue;
    const flag = (PermissionsBitField.Flags as Record<string, bigint>)[key];
    if (typeof flag === "bigint") bits |= flag;
  }
  return bits === 0n ? undefined : bits;
}

function findRole(guild: Guild, roleId?: string, roleName?: string) {
  if (roleId) {
    const byId = guild.roles.cache.get(roleId.replace(/[<@&>]/g, "").trim());
    if (byId) return byId;
  }
  if (!roleName?.trim()) return null;
  const wanted = roleName.trim().toLowerCase();
  return guild.roles.cache.find((r) => r.name.toLowerCase() === wanted) ?? null;
}

async function ensureCanManageRoles(message: Message): Promise<{ error: string } | { guild: Guild }> {
  const guild = getTargetGuild(message);
  if (!guild) return { error: "nenhum servidor encontrado." };
  if (!canModerate(message)) return { error: "sem permissão. Só o dono ou admins podem mexer com cargos." };
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageRoles)) return { error: "o bot não tem permissão Gerenciar Cargos." };
  return { guild };
}

async function executeCreateRole(message: Message, action: Extract<FwpAction, { type: "create_role" }>): Promise<string> {
  const check = await ensureCanManageRoles(message);
  if ("error" in check) return `Não criei cargo: ${check.error}`;
  const guild = check.guild;
  const name = (action.name?.trim() || "Novo Cargo").slice(0, 100);
  try {
    const role = await guild.roles.create({
      name,
      color: parseColor(action.color),
      hoist: action.hoist ?? false,
      mentionable: action.mentionable ?? false,
      permissions: parsePermissions(action.permissions),
      reason: action.reason || `Cargo criado via FWP por ${message.author.tag}`
    });
    await recordMessageEvent("ai_action", message, `Cargo criado via FWP: ${role.name} (${role.id})`, { action: "create_role", roleId: role.id });
    return `Cargo criado: <@&${role.id}> (\`${role.name}\`).`;
  } catch (err) {
    return `Não consegui criar cargo: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeEditRole(message: Message, action: Extract<FwpAction, { type: "edit_role" }>): Promise<string> {
  const check = await ensureCanManageRoles(message);
  if ("error" in check) return `Não editei cargo: ${check.error}`;
  const guild = check.guild;
  const role = findRole(guild, action.roleId, action.role);
  if (!role) return `Cargo não encontrado: \`${action.roleId || action.role || "?"}\`.`;
  const me = guild.members.me;
  if (me && role.position >= (me.roles.highest?.position ?? 0)) {
    return `Não consegui editar cargo: \`${role.name}\` está acima do meu maior cargo.`;
  }
  try {
    const patch: Record<string, unknown> = {};
    if (action.name?.trim()) patch.name = action.name.trim().slice(0, 100);
    const c = parseColor(action.color);
    if (c !== undefined) patch.color = c;
    if (action.hoist !== undefined) patch.hoist = action.hoist;
    if (action.mentionable !== undefined) patch.mentionable = action.mentionable;
    const perms = parsePermissions(action.permissions);
    if (perms !== undefined) patch.permissions = perms;
    const updated = await role.edit({ ...patch, reason: action.reason || `Editado via FWP por ${message.author.tag}` });
    await recordMessageEvent("ai_action", message, `Cargo editado via FWP: ${updated.name} (${updated.id})`, { action: "edit_role", roleId: updated.id, patch: Object.keys(patch) });
    return `Cargo atualizado: <@&${updated.id}>.`;
  } catch (err) {
    return `Não consegui editar cargo: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeDeleteRole(message: Message, action: Extract<FwpAction, { type: "delete_role" }>): Promise<string> {
  const check = await ensureCanManageRoles(message);
  if ("error" in check) return `Não deletei cargo: ${check.error}`;
  const role = findRole(check.guild, action.roleId, action.role);
  if (!role) return `Cargo não encontrado: \`${action.roleId || action.role || "?"}\`.`;
  if (role.managed || role.id === check.guild.id) return "Não posso deletar esse cargo (gerenciado/sistema).";
  try {
    const name = role.name;
    await role.delete(action.reason || `Deletado via FWP por ${message.author.tag}`);
    await recordMessageEvent("ai_action", message, `Cargo deletado via FWP: ${name}`, { action: "delete_role", roleId: role.id });
    return `Cargo **${name}** deletado.`;
  } catch (err) {
    return `Não consegui deletar cargo: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeAssignRole(message: Message, action: Extract<FwpAction, { type: "assign_role" }>): Promise<string> {
  const check = await ensureCanManageRoles(message);
  if ("error" in check) return `Não atribuí cargo: ${check.error}`;
  const guild = check.guild;
  const rawId = action.userId?.replace(/[<@!>]/g, "").trim();
  const targetId = rawId || message.mentions.users.filter(u => u.id !== message.client.user?.id).first()?.id;
  if (!targetId) return "Não atribuí cargo: nenhum usuário informado.";
  const role = findRole(guild, action.roleId, action.role);
  if (!role) return `Cargo não encontrado: \`${action.roleId || action.role || "?"}\`.`;
  try {
    const member = await guild.members.fetch(targetId);
    await member.roles.add(role.id, action.reason || `Cargo atribuído via FWP por ${message.author.tag}`);
    await recordMessageEvent("ai_action", message, `Cargo ${role.name} atribuído a ${member.user.tag}`, { action: "assign_role", roleId: role.id, targetId });
    return `Cargo <@&${role.id}> dado a **${member.user.tag}**.`;
  } catch (err) {
    return `Não consegui atribuir cargo: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeRemoveRole(message: Message, action: Extract<FwpAction, { type: "remove_role" }>): Promise<string> {
  const check = await ensureCanManageRoles(message);
  if ("error" in check) return `Não removi cargo: ${check.error}`;
  const guild = check.guild;
  const rawId = action.userId?.replace(/[<@!>]/g, "").trim();
  const targetId = rawId || message.mentions.users.filter(u => u.id !== message.client.user?.id).first()?.id;
  if (!targetId) return "Não removi cargo: nenhum usuário informado.";
  const role = findRole(guild, action.roleId, action.role);
  if (!role) return `Cargo não encontrado: \`${action.roleId || action.role || "?"}\`.`;
  try {
    const member = await guild.members.fetch(targetId);
    await member.roles.remove(role.id, action.reason || `Cargo removido via FWP por ${message.author.tag}`);
    await recordMessageEvent("ai_action", message, `Cargo ${role.name} removido de ${member.user.tag}`, { action: "remove_role", roleId: role.id, targetId });
    return `Cargo <@&${role.id}> removido de **${member.user.tag}**.`;
  } catch (err) {
    return `Não consegui remover cargo: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// =================== CHANNELS extra ===================

async function executeRenameChannel(message: Message, action: Extract<FwpAction, { type: "rename_channel" }>): Promise<string> {
  const check = await ensureCanManageChannels(message);
  if ("error" in check) return `Não renomeei canal: ${check.error}`;
  const channel = findChannel(check.guild, action.channel, action.channelId);
  if (!channel) return `Canal não encontrado: \`${action.channelId || action.channel || "?"}\`.`;
  try {
    const patch: Record<string, unknown> = {};
    if (action.newName?.trim()) {
      patch.name = channel.type === ChannelType.GuildCategory
        ? normalizeCategoryName(action.newName)
        : normalizeChannelName(action.newName);
    }
    if (action.topic !== undefined && "setTopic" in channel) {
      patch.topic = action.topic.slice(0, 1024);
    }
    if (Object.keys(patch).length === 0) return "Não renomeei canal: nada a alterar.";
    const updated = await (channel as any).edit({ ...patch, reason: action.reason || `Editado via FWP por ${message.author.tag}` });
    await recordMessageEvent("ai_action", message, `Canal editado via FWP: ${updated.name} (${updated.id})`, { action: "rename_channel", channelId: updated.id, patch: Object.keys(patch) });
    return `Canal atualizado: <#${updated.id}>.`;
  } catch (err) {
    return `Não consegui renomear canal: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeDeleteChannel(message: Message, action: Extract<FwpAction, { type: "delete_channel" }>): Promise<string> {
  const check = await ensureCanManageChannels(message);
  if ("error" in check) return `Não deletei canal: ${check.error}`;
  const channel = findChannel(check.guild, action.channel, action.channelId);
  if (!channel) return `Canal não encontrado: \`${action.channelId || action.channel || "?"}\`.`;
  try {
    const name = channel.name;
    await channel.delete(action.reason || `Deletado via FWP por ${message.author.tag}`);
    await recordMessageEvent("ai_action", message, `Canal deletado via FWP: ${name}`, { action: "delete_channel", channelId: channel.id });
    return `Canal **${name}** deletado.`;
  } catch (err) {
    return `Não consegui deletar canal: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeDeleteCategory(message: Message, action: Extract<FwpAction, { type: "delete_category" }>): Promise<string> {
  const check = await ensureCanManageChannels(message);
  if ("error" in check) return `Não deletei categoria: ${check.error}`;
  const guild = check.guild;
  const cat = action.categoryId
    ? guild.channels.cache.get(action.categoryId)
    : action.category
      ? guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && comparableName(c.name) === comparableName(action.category!))
      : null;
  if (!cat || cat.type !== ChannelType.GuildCategory) return `Categoria não encontrada.`;
  try {
    const name = cat.name;
    if (action.deleteChildren) {
      const children = guild.channels.cache.filter((c) => "parentId" in c && c.parentId === cat.id);
      for (const child of children.values()) {
        await child.delete(action.reason || `Deletado em cascata via FWP por ${message.author.tag}`).catch(() => {});
      }
    }
    await cat.delete(action.reason || `Deletado via FWP por ${message.author.tag}`);
    await recordMessageEvent("ai_action", message, `Categoria deletada via FWP: ${name}`, { action: "delete_category", categoryId: cat.id, deleteChildren: action.deleteChildren });
    return `Categoria **${name}** deletada${action.deleteChildren ? " (com canais filhos)" : ""}.`;
  } catch (err) {
    return `Não consegui deletar categoria: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeSetNickname(message: Message, action: Extract<FwpAction, { type: "set_nickname" }>): Promise<string> {
  const guild = getTargetGuild(message);
  if (!guild) return "Não troquei apelido: nenhum servidor encontrado.";
  if (!canModerate(message)) return "Não troquei apelido: sem permissão.";
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageNicknames)) return "Não troquei apelido: bot sem permissão Gerenciar Apelidos.";
  const rawId = action.userId?.replace(/[<@!>]/g, "").trim();
  const targetId = rawId || message.mentions.users.filter(u => u.id !== message.client.user?.id).first()?.id;
  if (!targetId) return "Não troquei apelido: nenhum usuário informado.";
  try {
    const member = await guild.members.fetch(targetId);
    await member.setNickname((action.nickname ?? "").slice(0, 32) || null, action.reason || `Apelido alterado via FWP por ${message.author.tag}`);
    await recordMessageEvent("ai_action", message, `Apelido alterado via FWP: ${member.user.tag} -> ${action.nickname ?? "(removido)"}`, { action: "set_nickname", targetId });
    return `Apelido de **${member.user.tag}** atualizado para \`${action.nickname || "(padrão)"}\`.`;
  } catch (err) {
    return `Não consegui mudar apelido: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeUnbanMember(message: Message, action: Extract<FwpAction, { type: "unban_member" }>): Promise<string> {
  const guild = getTargetGuild(message);
  if (!guild) return "Não desbanei: nenhum servidor.";
  if (!canModerate(message)) return "Não desbanei: sem permissão.";
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.BanMembers)) return "Não desbanei: bot sem permissão Banir Membros.";
  const rawId = action.userId?.replace(/[<@!>]/g, "").trim();
  if (!rawId) return "Não desbanei: nenhum userId.";
  try {
    await guild.bans.remove(rawId, action.reason || `Desbanido via FWP por ${message.author.tag}`);
    await recordMessageEvent("ai_action", message, `Desban executado via FWP: ${rawId}`, { action: "unban_member", targetId: rawId });
    return `Usuário \`${rawId}\` desbanido.`;
  } catch (err) {
    return `Não consegui desbanir: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executePinMessage(message: Message, action: Extract<FwpAction, { type: "pin_message" }>): Promise<string> {
  const guild = getTargetGuild(message);
  if (!guild) return "Não fixei mensagem: nenhum servidor.";
  if (!canModerate(message)) return "Não fixei mensagem: sem permissão.";
  if (!action.messageId?.trim()) return "Não fixei mensagem: messageId não informado.";
  let channel: any = null;
  if (action.channelId) channel = guild.channels.cache.get(action.channelId) ?? null;
  else if (action.channel) channel = guild.channels.cache.find((c) => comparableName(c.name) === comparableName(action.channel!)) ?? null;
  else channel = message.channel;
  if (!channel?.isTextBased?.()) return "Canal alvo inválido para fixar mensagem.";
  try {
    const msg = await channel.messages.fetch(action.messageId.trim());
    await msg.pin(action.reason || `Fixada via FWP por ${message.author.tag}`);
    await recordMessageEvent("ai_action", message, `Mensagem fixada: ${action.messageId} em #${channel.name}`, { action: "pin_message", channelId: channel.id, messageId: action.messageId });
    return `Mensagem fixada em <#${channel.id}>.`;
  } catch (err) {
    return `Não consegui fixar mensagem: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeDeleteMessage(message: Message, action: Extract<FwpAction, { type: "delete_message" }>): Promise<string> {
  const guild = getTargetGuild(message);
  if (!guild) return "Não deletei mensagem: nenhum servidor.";
  if (!canModerate(message)) return "Não deletei mensagem: sem permissão.";
  if (!action.messageId?.trim()) return "Não deletei mensagem: messageId não informado.";
  let channel: any = null;
  if (action.channelId) channel = guild.channels.cache.get(action.channelId) ?? null;
  else if (action.channel) channel = guild.channels.cache.find((c) => comparableName(c.name) === comparableName(action.channel!)) ?? null;
  else channel = message.channel;
  if (!channel?.isTextBased?.()) return "Canal alvo inválido para deletar mensagem.";
  try {
    const msg = await channel.messages.fetch(action.messageId.trim());
    await msg.delete();
    await recordMessageEvent("ai_action", message, `Mensagem deletada: ${action.messageId} em #${channel.name}`, { action: "delete_message", channelId: channel.id, messageId: action.messageId });
    return `Mensagem deletada em <#${channel.id}>.`;
  } catch (err) {
    return `Não consegui deletar mensagem: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeSetChannelPermissions(message: Message, action: Extract<FwpAction, { type: "set_channel_permissions" }>): Promise<string> {
  const check = await ensureCanManageChannels(message);
  if ("error" in check) return `Não defini permissões: ${check.error}`;
  const guild = check.guild;
  const channel = findChannel(guild, action.channel, action.channelId);
  if (!channel) return `Canal não encontrado: \`${action.channelId || action.channel || "?"}\`.`;
  if (!("permissionOverwrites" in channel)) return "Esse canal não suporta overwrites de permissão.";

  // Resolve target id (role or member). Default = role.
  const kind = action.targetType ?? "role";
  let targetId = action.targetId?.replace(/[<@!&>]/g, "").trim();
  if (!targetId && action.target) {
    if (kind === "role") {
      const role = findRole(guild, undefined, action.target);
      targetId = role?.id;
    } else {
      const wanted = action.target.toLowerCase();
      const member = guild.members.cache.find((m) => m.user.username.toLowerCase() === wanted || m.displayName.toLowerCase() === wanted);
      targetId = member?.id;
    }
  }
  if (!targetId) return "Não defini permissões: alvo (cargo/membro) não identificado.";

  const allow = parsePermissions(action.allow);
  const deny = parsePermissions(action.deny);
  const clear = action.clear?.map((p) => (PermissionsBitField.Flags as Record<string, bigint>)[p.trim()]).filter((b): b is bigint => typeof b === "bigint") ?? [];

  try {
    const overwriteOptions: Record<string, boolean | null> = {};
    if (allow) {
      for (const [name, bit] of Object.entries(PermissionsBitField.Flags)) {
        if ((allow & (bit as bigint)) !== 0n) overwriteOptions[name] = true;
      }
    }
    if (deny) {
      for (const [name, bit] of Object.entries(PermissionsBitField.Flags)) {
        if ((deny & (bit as bigint)) !== 0n) overwriteOptions[name] = false;
      }
    }
    for (const bit of clear) {
      for (const [name, b] of Object.entries(PermissionsBitField.Flags)) {
        if (b === bit) overwriteOptions[name] = null;
      }
    }
    if (Object.keys(overwriteOptions).length === 0) return "Não defini permissões: nada para alterar (allow/deny/clear vazios).";

    await (channel as any).permissionOverwrites.edit(targetId, overwriteOptions, {
      reason: action.reason || `Permissões ajustadas via FWP por ${message.author.tag}`,
      type: kind === "member" ? 1 : 0
    });
    await recordMessageEvent("ai_action", message, `Permissões do canal ${channel.name} atualizadas para ${kind} ${targetId}`, { action: "set_channel_permissions", channelId: channel.id, targetId, allow: action.allow, deny: action.deny, clear: action.clear });
    return `Permissões de <#${channel.id}> ajustadas para ${kind === "role" ? `<@&${targetId}>` : `<@${targetId}>`}.`;
  } catch (err) {
    return `Não consegui ajustar permissões: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function executeMuteMember(message: Message, action: Extract<FwpAction, { type: "mute_member" }>): Promise<string> {
  const guild = getTargetGuild(message);
  if (!guild) return "Não executei mute: nenhum servidor encontrado.";
  if (!canModerate(message)) return "Não executei mute: sem permissão. Só o dono ou admins podem pedir isso.";

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return "Não executei mute: o bot não tem permissão de silenciar membros.";

  const rawId = action.userId?.replace(/[<@!>]/g, "").trim();
  const targetId = rawId || message.mentions.users.filter(u => u.id !== message.client.user?.id).first()?.id;
  if (!targetId) return "Não executei mute: nenhum usuário mencionado ou ID informado.";

  const durationMs = Math.min(Math.max((action.durationMinutes ?? 10) * 60 * 1000, 60000), 40320 * 60 * 1000);

  try {
    const target = await guild.members.fetch(targetId).catch(() => null);
    if (!target) return `Não executei mute: usuário \`${targetId}\` não encontrado.`;

    await target.timeout(durationMs, action.reason || `Silenciado via FWP por ${message.author.tag}`);

    const mins = Math.round(durationMs / 60000);
    await recordMessageEvent("ai_action", message, `Mute executado via FWP: ${target.user.tag} (${targetId}) por ${mins} min`, { action: "mute_member", targetId, durationMs });
    return `**${target.user.tag}** foi silenciado por ${mins} minuto(s). Motivo: ${action.reason || "não especificado"}.`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Não consegui silenciar: ${msg}`;
  }
}

async function executeRestartSelf(message: Message, action: Extract<FwpAction, { type: "restart_self" }>): Promise<string> {
  if (message.author.id !== BOT_OWNER_ID) return "Reinicialização negada: apenas o dono pode reiniciar o bot.";
  await recordMessageEvent("system", message, `Reinicialização via FWP solicitada. Motivo: ${action.reason || "não especificado"}`, { action: "restart_self" });
  // Give time for the message to be sent before exiting
  setTimeout(() => process.exit(0), 2000);
  return `Reiniciando agora... Motivo: ${action.reason || "não especificado"}.`;
}

async function executeSendMessage(message: Message, action: Extract<FwpAction, { type: "send_message" }>): Promise<string> {
  if (!canModerate(message)) return "Não enviei mensagem: sem permissão. Só o dono ou admins podem usar isso.";

  const content = action.content?.trim();
  if (!content) return "Não enviei mensagem: conteúdo vazio.";

  // Send DM to a user by userId
  if (action.userId) {
    const rawId = action.userId.replace(/[<@!>]/g, "").trim();
    try {
      const user = await message.client.users.fetch(rawId);
      const dm = await user.createDM();
      await dm.send(content);
      await recordMessageEvent("ai_action", message, `DM enviada via FWP para ${user.tag} (${rawId}): ${content.slice(0, 200)}`, { action: "send_message", userId: rawId });
      return `DM enviada para **${user.tag}** (${rawId}).`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Não consegui enviar DM para \`${rawId}\`: ${msg}`;
    }
  }

  // Send to a guild channel
  const guild = getTargetGuild(message);
  if (!guild) return "Não enviei mensagem: nenhum servidor encontrado e nenhum userId especificado.";

  let targetChannel: import("discord.js").GuildBasedChannel | null | undefined = null;

  if (action.channelId) {
    targetChannel = guild.channels.cache.get(action.channelId) ?? null;
  } else if (action.channel) {
    const wanted = comparableName(action.channel);
    targetChannel = guild.channels.cache.find(c => comparableName(c.name) === wanted) ?? null;
  }

  if (!targetChannel) return `Canal não encontrado: \`${action.channelId || action.channel || "não especificado"}\`.`;
  if (!targetChannel.isTextBased()) return `Canal \`${targetChannel.name}\` não é um canal de texto.`;

  try {
    await targetChannel.send(content);
    await recordMessageEvent("ai_action", message, `Mensagem enviada via FWP para #${targetChannel.name}: ${content.slice(0, 200)}`, { action: "send_message", channelId: targetChannel.id });
    return `Mensagem enviada em <#${targetChannel.id}>.`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Não consegui enviar mensagem: ${msg}`;
  }
}

async function executeGenerateImage(message: Message, action: Extract<FwpAction, { type: "generate_image" }>): Promise<string> {
  const prompt = action.prompt?.trim();
  if (!prompt) return "Imagem não gerada: prompt vazio.";

  try {
    const img = await generateImage(prompt, action.imageUrl?.trim() || undefined);
    const attachment = new AttachmentBuilder(img.buffer, { name: `imagem.${img.ext}` });
    await message.channel.send({ files: [attachment] });
    await recordMessageEvent("ai_action", message, `Imagem gerada via FWP. Prompt: ${prompt.slice(0, 200)}`, { action: "generate_image", prompt });
    return "Imagem gerada e enviada.";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Não consegui gerar a imagem: ${msg}`;
  }
}

export async function executeFwpActions(message: Message, response: string): Promise<FwpExecutionResult> {
  const actions = extractActions(response);
  const reports: string[] = [];
  const fileReads: FwpFileRead[] = [];
  const memoryNotes: string[] = [];

  const hasWriteActions = actions.some(a => a.type === "write_source_file");

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
        continue;
      }

      if (action.type === "read_source_file") {
        reports.push(await executeReadSourceFile(message, action, fileReads));
        continue;
      }

      if (action.type === "write_source_file") {
        reports.push(await executeWriteSourceFile(message, action));
        continue;
      }

      if (action.type === "list_source_files") {
        reports.push(await executeListSourceFiles(message, action));
        continue;
      }

      if (action.type === "generate_image") {
        const report = await executeGenerateImage(message, action);
        reports.push(report);
        if (report === "Imagem gerada e enviada." && action.prompt?.trim()) {
          const promptShort = action.prompt.trim().slice(0, 400);
          const isEdit = !!action.imageUrl?.trim();
          memoryNotes.push(
            isEdit
              ? `[IMAGEM_GERADA_POR_MIM] Editei a imagem que o usuário enviou. Edição aplicada (em inglês): "${promptShort}". A imagem editada foi enviada no chat — se o usuário pedir mais alterações, me refira a essa edição.`
              : `[IMAGEM_GERADA_POR_MIM] Gerei e enviei uma imagem no chat. Prompt usado (em inglês): "${promptShort}". Lembre-se desta imagem se o usuário fizer perguntas, pedir variações ou edições.`
          );
        }
        continue;
      }

      if (action.type === "mute_member") {
        reports.push(await executeMuteMember(message, action));
        continue;
      }

      if (action.type === "send_message") {
        reports.push(await executeSendMessage(message, action));
        continue;
      }

      if (action.type === "restart_self") {
        if (hasWriteActions) {
          reports.push("Reinicialização adiada — aguardando confirmação da escrita. Confirme o diff acima, então diga para eu reiniciar.");
          continue;
        }
        reports.push(await executeRestartSelf(message, action));
        continue;
      }

      if (action.type === "fetch_url") {
        reports.push(await executeFetchUrl(message, action));
        continue;
      }

      if (action.type === "dns_lookup") {
        reports.push(await executeDnsLookup(message, action));
        continue;
      }

      if (action.type === "shell_exec") {
        reports.push(await executeShellExec(message, action));
        continue;
      }

      if (action.type === "cs_write_file") {
        reports.push(await executeCsWriteFile(message, action));
        continue;
      }

      if (action.type === "cs_read_file") {
        reports.push(await executeCsReadFile(message, action));
        continue;
      }

      if (action.type === "cs_list_files") {
        reports.push(await executeCsListFiles(message, action));
        continue;
      }

      if (action.type === "cs_send_file") {
        reports.push(await executeCsSendFile(message, action));
        continue;
      }

      if (action.type === "cs_reload_commands") {
        await csReloadCommands();
        reports.push("Comandos serão recarregados. Reiniciando o bot...");
        setTimeout(() => process.exit(0), 3000);
        continue;
      }

      if (action.type === "create_role") { reports.push(await executeCreateRole(message, action)); continue; }
      if (action.type === "edit_role") { reports.push(await executeEditRole(message, action)); continue; }
      if (action.type === "delete_role") { reports.push(await executeDeleteRole(message, action)); continue; }
      if (action.type === "assign_role") { reports.push(await executeAssignRole(message, action)); continue; }
      if (action.type === "remove_role") { reports.push(await executeRemoveRole(message, action)); continue; }
      if (action.type === "rename_channel") { reports.push(await executeRenameChannel(message, action)); continue; }
      if (action.type === "delete_channel") { reports.push(await executeDeleteChannel(message, action)); continue; }
      if (action.type === "delete_category") { reports.push(await executeDeleteCategory(message, action)); continue; }
      if (action.type === "set_nickname") { reports.push(await executeSetNickname(message, action)); continue; }
      if (action.type === "unban_member") { reports.push(await executeUnbanMember(message, action)); continue; }
      if (action.type === "pin_message") { reports.push(await executePinMessage(message, action)); continue; }
      if (action.type === "delete_message") { reports.push(await executeDeleteMessage(message, action)); continue; }
      if (action.type === "set_channel_permissions") { reports.push(await executeSetChannelPermissions(message, action)); continue; }

      reports.push(`Ação FWP ignorada: tipo desconhecido (${String((action as { type?: string }).type)}).`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "erro desconhecido";
      const stack = error instanceof Error ? error.stack?.slice(0, 500) : undefined;
      reports.push(`Ação FWP falhou (${action.type}): ${msg}`);
      await recordMessageEvent("ai_action", message, `Falha ao executar ação ${action.type}: ${msg}`, { action, stack }).catch(() => {});
      await recordMemorialEvent({
        type: "ai_action",
        content: `[ERRO FWP] Ação "${action.type}" falhou: ${msg}`,
        metadata: { action, error: msg, stack }
      }).catch(() => {});
    }
  }

  return { reports, fileReads, memoryNotes };
}

export function buildFileReadFollowUp(fileReads: FwpFileRead[]): string {
  const blocks = fileReads.map(({ path, content }) => {
    const preview = content.length > 40000 ? content.slice(0, 40000) + "\n...[arquivo muito grande — use fromLine/toLine para ler por partes]" : content;
    return `[CONTEÚDO DO ARQUIVO: ${path}]\n\`\`\`\n${preview}\n\`\`\``;
  });
  return [
    "[SISTEMA] Leitura concluída. Conteúdos dos arquivos abaixo.",
    "AGORA escreva o arquivo completo usando o formato FWP_WRITE_FILE (não JSON):",
    "",
    "  [FWP_WRITE_FILE]",
    "  path: src/commands/exemplo.ts",
    "  ---",
    "  // conteúdo TypeScript completo aqui",
    "  [/FWP_WRITE_FILE]",
    "",
    "CRÍTICO: escreva o arquivo INTEIRO. Sem '// resto do código'. Sem resumos. Código real e completo.",
    "",
    ...blocks
  ].join("\n");
}