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
  | { type: "cs_reload_commands" };

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
  _action: Extract<FwpAction, { type: "read_source_file" }>,
  _pendingReads: FwpFileRead[]
): Promise<string> {
  return "Acesso ao código-fonte removido do Discord. Use o ChatBOT no site FAW_HUB para gerenciar o código.";
}

async function executeWriteSourceFile(_message: Message, _action: Extract<FwpAction, { type: "write_source_file" }>): Promise<string> {
  return "Acesso ao código-fonte removido do Discord. Use o ChatBOT no site FAW_HUB para gerenciar o código.";
}

async function executeListSourceFiles(_message: Message, _action: Extract<FwpAction, { type: "list_source_files" }>): Promise<string> {
  return "Acesso ao código-fonte removido do Discord. Use o ChatBOT no site FAW_HUB para gerenciar o código.";
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
        reports.push(await executeGenerateImage(message, action));
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

      reports.push(`Ação FWP ignorada: tipo desconhecido (${String(action.type)}).`);
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

  return { reports, fileReads };
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