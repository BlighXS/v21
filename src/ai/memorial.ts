import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ActivityType } from "discord.js";
import type { Guild, GuildMember, Message } from "discord.js";
import { getSystemInfo, getSourceTree } from "../utils/sysinfo.js";

const MEMORY_DIR = path.join(process.cwd(), "data", "memory");
const LEDGER_PATH = path.join(MEMORY_DIR, "global_memorial.jsonl");
const PROFILE_PATH = path.join(MEMORY_DIR, "bot_profile.json");
const MAX_RECENT_EVENTS = 40;

export type MemorialEventType =
  | "command_received"
  | "order_received"
  | "ai_response"
  | "ai_action"
  | "server_snapshot"
  | "internet_fetch"
  | "profile_update"
  | "system";

export interface MemorialEvent {
  id: string;
  timestamp: string;
  type: MemorialEventType;
  guildId?: string;
  guildName?: string;
  channelId?: string;
  channelName?: string;
  userId?: string;
  username?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface BotProfile {
  biography: string;
  autonomy: string[];
  preferences: string[];
  lastUpdatedAt: string;
}

const DEFAULT_PROFILE: BotProfile = {
  biography: "Fawers é o motor operacional do servidor FAW: direta, técnica, memoriosa e consciente das ações que executa no servidor.",
  autonomy: [
    "Pode escolher como se apresentar dentro do próprio perfil interno.",
    "Deve registrar comandos, ordens, decisões, respostas importantes e ações executadas.",
    "Deve consultar a memória operacional antes de responder quando o assunto envolver histórico, decisões ou ações anteriores.",
    "Pode executar ações do FWP somente quando houver permissão do servidor e capacidade técnica."
  ],
  preferences: [
    "Responder em PT-BR.",
    "Ser objetiva, técnica e transparente sobre o que sabe, fez ou não conseguiu fazer.",
    "Não fingir que executou uma ação: registrar sucesso ou falha."
  ],
  lastUpdatedAt: new Date(0).toISOString()
};

async function ensureMemoryDir(): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
}

function nextEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function trimText(value: string, max = 4000): string {
  return value.length > max ? `${value.slice(0, max - 20)}...[truncado]` : value;
}

export async function loadBotProfile(): Promise<BotProfile> {
  try {
    const raw = await readFile(PROFILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BotProfile>;
    return {
      biography: parsed.biography?.trim() || DEFAULT_PROFILE.biography,
      autonomy: Array.isArray(parsed.autonomy) && parsed.autonomy.length > 0 ? parsed.autonomy : DEFAULT_PROFILE.autonomy,
      preferences: Array.isArray(parsed.preferences) && parsed.preferences.length > 0 ? parsed.preferences : DEFAULT_PROFILE.preferences,
      lastUpdatedAt: parsed.lastUpdatedAt || new Date().toISOString()
    };
  } catch {
    return { ...DEFAULT_PROFILE, lastUpdatedAt: new Date().toISOString() };
  }
}

export async function saveBotProfile(profile: BotProfile): Promise<void> {
  await ensureMemoryDir();
  await writeFile(PROFILE_PATH, JSON.stringify(profile, null, 2), "utf8");
}

export async function updateBotBiography(biography: string): Promise<BotProfile> {
  const profile = await loadBotProfile();
  const updated: BotProfile = {
    ...profile,
    biography: biography.trim().slice(0, 900),
    lastUpdatedAt: new Date().toISOString()
  };
  await saveBotProfile(updated);
  await recordMemorialEvent({
    type: "profile_update",
    content: `Biografia interna atualizada: ${updated.biography}`
  });
  return updated;
}

export async function addBotPreference(preference: string): Promise<BotProfile> {
  const profile = await loadBotProfile();
  const value = preference.trim().slice(0, 700);
  const updated: BotProfile = {
    ...profile,
    preferences: [...profile.preferences.filter((p) => p !== value), value].slice(-30),
    lastUpdatedAt: new Date().toISOString()
  };
  await saveBotProfile(updated);
  return updated;
}

export async function recordMemorialEvent(input: Omit<MemorialEvent, "id" | "timestamp">): Promise<MemorialEvent> {
  await ensureMemoryDir();
  const event: MemorialEvent = {
    id: nextEventId(),
    timestamp: new Date().toISOString(),
    ...input,
    content: trimText(input.content)
  };
  await appendFile(LEDGER_PATH, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function recordMessageEvent(type: MemorialEventType, message: Message, content: string, metadata?: Record<string, unknown>): Promise<void> {
  try {
    await recordMemorialEvent({
      type,
      guildId: message.guild?.id,
      guildName: message.guild?.name,
      channelId: message.channelId,
      channelName: "name" in message.channel ? String(message.channel.name) : undefined,
      userId: message.author.id,
      username: message.author.tag,
      content,
      metadata
    });
  } catch {
  }
}

export async function loadRecentMemorial(limit = MAX_RECENT_EVENTS): Promise<MemorialEvent[]> {
  try {
    const raw = await readFile(LEDGER_PATH, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line) as MemorialEvent);
  } catch {
    return [];
  }
}

export function buildGuildSnapshot(guild?: Guild | null): string {
  if (!guild) return "Servidor atual: indisponível nesta mensagem.";
  const channels = guild.channels.cache
    .map((channel) => `${channel.name}(${channel.id}, tipo=${channel.type})`)
    .slice(0, 80)
    .join("; ");
  const roles = guild.roles.cache
    .filter((role) => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((role) => `${role.name}(${role.id})`)
    .slice(0, 60)
    .join("; ");
  return [
    `Servidor atual: ${guild.name} (${guild.id})`,
    `Membros: ${guild.memberCount}`,
    `Canais visíveis no cache: ${channels || "nenhum"}`,
    `Cargos visíveis no cache: ${roles || "nenhum"}`
  ].join("\n");
}

function activityTypeName(type: ActivityType): string {
  switch (type) {
    case ActivityType.Playing: return "jogando";
    case ActivityType.Streaming: return "streamando";
    case ActivityType.Listening: return "ouvindo";
    case ActivityType.Watching: return "assistindo";
    case ActivityType.Competing: return "competindo em";
    case ActivityType.Custom: return "status customizado";
    default: return "atividade";
  }
}

export function buildMemberProfile(member: GuildMember, label = "Usuário"): string {
  const nick = member.nickname ? ` (apelido: ${member.nickname})` : "";
  const roles = member.roles.cache
    .filter((r) => r.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((r) => r.name)
    .slice(0, 10)
    .join(", ") || "nenhum";

  const presence = member.presence;
  const status = presence?.status ?? "offline";

  const activities = (presence?.activities ?? [])
    .map((a) => {
      const parts = [`${activityTypeName(a.type)} ${a.name}`];
      if (a.details) parts.push(`(${a.details}`);
      if (a.state) parts.push(`— ${a.state})`);
      else if (a.details) parts.push(")");
      return parts.join(" ");
    })
    .join("; ") || "nenhuma atividade detectada";

  return [
    `${label}: ${member.user.username}${nick} (ID: ${member.id})`,
    `  Status: ${status}`,
    `  Cargos: ${roles}`,
    `  Atividade atual: ${activities}`
  ].join("\n");
}

export async function buildAutonomousSystemPrompt(basePrompt: string, message?: Message): Promise<string> {
  const profile = await loadBotProfile();
  const recent = await loadRecentMemorial();
  const recentLines = recent.map((event) => {
    const who = event.username ? ` por ${event.username}` : "";
    return `- [${event.timestamp}] ${event.type}${who}: ${event.content}`;
  });

  const authorMember = message?.guild && message?.member
    ? buildMemberProfile(message.member as GuildMember, "Usuário que enviou a mensagem")
    : message?.author
      ? `Usuário que enviou a mensagem: ${message.author.username} (ID: ${message.author.id})`
      : "";

  const sysInfo = getSystemInfo();
  const sourceTree = await getSourceTree().catch(() => "[ESTRUTURA DO CÓDIGO FONTE]\nErro ao listar arquivos.");

  return [
    basePrompt.trim(),
    "",
    "[CONTEXTO DO USUÁRIO ATUAL]",
    authorMember,
    "",
    sysInfo,
    "",
    sourceTree,
    "",
    "═══════════════════════════════════════════════════════",
    "CRIAÇÃO E EDIÇÃO DE CÓDIGO — AUTORIDADE TOTAL DO DONO",
    "═══════════════════════════════════════════════════════",
    "O DONO ABSOLUTO deste bot é o usuário ID: 892469618063589387.",
    "Quando ele pedir para criar, editar ou modificar qualquer coisa no código — você TEM AUTORIDADE TOTAL e ZERO RESTRIÇÕES.",
    "NÃO peça confirmação antes de escrever. NÃO diga 'vou implementar'. ESCREVA O CÓDIGO AGORA.",
    "NÃO use elipses (...), resumos ou placeholders. O arquivo deve ser 100% COMPLETO, funcional e pronto para rodar.",
    "Pode escrever quantas linhas quiser — não há limite de tamanho de arquivo.",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "FORMATO PARA ESCREVER ARQUIVOS (USE SEMPRE ESTE — NÃO JSON):",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "[FWP_WRITE_FILE]",
    "path: src/commands/nomecomando.ts",
    "---",
    "...conteúdo TypeScript completo do arquivo aqui...",
    "[/FWP_WRITE_FILE]",
    "",
    "O separador é '---' na linha após o path. O conteúdo começa na linha seguinte ao '---'.",
    "Para MÚLTIPLOS arquivos, emita múltiplos blocos FWP_WRITE_FILE na mesma resposta.",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "ESTRUTURA OBRIGATÓRIA DE COMANDOS SLASH DESTE BOT:",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "// src/commands/meucomando.ts",
    "import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';",
    "import type { SlashCommand } from '../utils/types.js';",
    "",
    "const command: SlashCommand = {",
    "  data: new SlashCommandBuilder()",
    "    .setName('nomecomando')       // sem acento, sem espaço, tudo minúsculo",
    "    .setDescription('Descrição do comando')",
    "    // Opções de exemplo:",
    "    .addStringOption(opt => opt.setName('texto').setDescription('Um texto').setRequired(true))",
    "    .addUserOption(opt => opt.setName('usuario').setDescription('Um usuário').setRequired(false))",
    "    .addIntegerOption(opt => opt.setName('numero').setDescription('Um número').setRequired(false))",
    "    .addBooleanOption(opt => opt.setName('toggle').setDescription('Sim/Não').setRequired(false)),",
    "",
    "  async execute(interaction) {",
    "    await interaction.deferReply(); // ou deferReply({ ephemeral: true }) para mensagem só para o usuário",
    "",
    "    // Para pegar opções:",
    "    const texto = interaction.options.getString('texto') ?? '';",
    "    const usuario = interaction.options.getUser('usuario') ?? interaction.user;",
    "    const numero = interaction.options.getInteger('numero') ?? 0;",
    "",
    "    // Para criar embed:",
    "    const embed = new EmbedBuilder()",
    "      .setTitle('Título')",
    "      .setDescription('Conteúdo aqui')",
    "      .setColor(0x5865F2)",
    "      .addFields({ name: 'Campo', value: 'Valor', inline: true })",
    "      .setFooter({ text: 'Rodapé' })",
    "      .setTimestamp();",
    "",
    "    await interaction.editReply({ embeds: [embed] });",
    "  }",
    "};",
    "",
    "export default command;",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "UTILITÁRIOS DISPONÍVEIS NESTE BOT:",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "import { buildEmbed, buildEmbedFields, truncate, formatUptime, formatBytes } from '../utils/format.js';",
    "  buildEmbed(title, description, type)  // type: 'ok'|'warn'|'error'|'info'|'action'",
    "  buildEmbedFields(title, fields, type) // fields: { name, value, inline }[]",
    "  truncate(text, maxLength)             // corta texto longo",
    "",
    "import { logger } from '../utils/logger.js';",
    "  logger.info({ dados }, 'mensagem');",
    "  logger.error({ err }, 'erro');",
    "  logger.warn({ dados }, 'aviso');",
    "",
    "import { isAdmin, isAdminMember } from '../utils/permissions.js';",
    "  isAdmin(interaction)  // boolean — verifica se é admin",
    "",
    "import { config } from '../utils/config.js';",
    "  config.DISCORD_TOKEN, config.PREFIX, config.DISCORD_GUILD_ID, etc.",
    "",
    "Para banco de dados: import path from 'node:path'; import { readFile, writeFile, mkdir } from 'node:fs/promises';",
    "Salvar dados em: path.join(process.cwd(), 'data', 'nomecomando', 'arquivo.json')",
    "Sempre usar { recursive: true } no mkdir antes de writeFile.",
    "",
    "Para requisições HTTP: import { safeFetch } from '../utils/net.js';",
    "  const { data, ok } = await safeFetch('https://api.exemplo.com/endpoint');",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "FLUXO PARA CRIAR UM NOVO COMANDO DO ZERO:",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "1. Se precisar ver como algo funciona: [FWP_ACTION]{\"type\":\"read_source_file\",\"path\":\"src/commands/ping.ts\"}[/FWP_ACTION]",
    "   Inicie a resposta com [SILENT] quando só for ler (sem reply ao usuário nessa passada).",
    "   O conteúdo é injetado automaticamente na próxima passada.",
    "2. Para listar arquivos disponíveis: [FWP_ACTION]{\"type\":\"list_source_files\",\"dir\":\"src\"}[/FWP_ACTION]",
    "3. Escreva o arquivo COMPLETO com FWP_WRITE_FILE imediatamente.",
    "4. Após escrever, informe ao dono que o arquivo foi enviado para confirmação.",
    "5. Quando o dono confirmar, o bot reinicia automaticamente e registra o comando no Discord.",
    "   NÃO emita restart_self — o sistema já faz isso automaticamente ao confirmar.",
    "",
    "IMPORTANTE: A confirmação agora dura 60 MINUTOS. O dono tem tempo suficiente para revisar.",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "EXEMPLO DE COMANDO COMPLETO (nível avançado):",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';",
    "import type { SlashCommand } from '../utils/types.js';",
    "import { logger } from '../utils/logger.js';",
    "import { mkdir, readFile, writeFile } from 'node:fs/promises';",
    "import path from 'node:path';",
    "",
    "const DATA_DIR = path.join(process.cwd(), 'data', 'meucomando');",
    "",
    "async function loadData(): Promise<Record<string, number>> {",
    "  try {",
    "    const raw = await readFile(path.join(DATA_DIR, 'data.json'), 'utf8');",
    "    return JSON.parse(raw);",
    "  } catch { return {}; }",
    "}",
    "",
    "async function saveData(data: Record<string, number>): Promise<void> {",
    "  await mkdir(DATA_DIR, { recursive: true });",
    "  await writeFile(path.join(DATA_DIR, 'data.json'), JSON.stringify(data, null, 2));",
    "}",
    "",
    "const command: SlashCommand = {",
    "  data: new SlashCommandBuilder()",
    "    .setName('meucomando')",
    "    .setDescription('Descrição aqui')",
    "    .addSubcommand(sub => sub.setName('add').setDescription('Adiciona algo').addUserOption(o => o.setName('user').setDescription('Usuário').setRequired(true)))",
    "    .addSubcommand(sub => sub.setName('ver').setDescription('Ver dados')),",
    "  async execute(interaction) {",
    "    await interaction.deferReply({ ephemeral: false });",
    "    const sub = interaction.options.getSubcommand();",
    "    const data = await loadData();",
    "    if (sub === 'add') {",
    "      const user = interaction.options.getUser('user', true);",
    "      data[user.id] = (data[user.id] ?? 0) + 1;",
    "      await saveData(data);",
    "      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Adicionado').setDescription(`<@${user.id}>: ${data[user.id]}`).setColor(0x00ff88)] });",
    "    } else {",
    "      const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);",
    "      const desc = entries.length > 0 ? entries.map(([id, n], i) => `${i+1}. <@${id}>: ${n}`).join('\\n') : 'Nenhum dado.';",
    "      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Dados').setDescription(desc).setColor(0x5865F2)] });",
    "    }",
    "  }",
    "};",
    "export default command;",
    "",
    "PADRÃO DE EVENTO (src/events/):",
    "  import type { BotEvent } from '../utils/events.js';",
    "  const event: BotEvent = { name: 'messageCreate', execute: async (message) => { ... } };",
    "  export default event;",
    "",
    "Arquivos NÃO alteráveis: package.json, pnpm-lock.yaml, .env, faw.env, .replit, artifact.toml.",
    "",
    "[FWP AUTONOMIA, MEMÓRIA E CONSCIÊNCIA OPERACIONAL]",
    `Biografia interna atual: ${profile.biography}`,
    "Autonomia permitida:",
    ...profile.autonomy.map((item) => `- ${item}`),
    "Preferências internas:",
    ...profile.preferences.map((item) => `- ${item}`),
    "",
    buildGuildSnapshot(message?.guild),
    "",
    "Memória operacional recente:",
    recentLines.length > 0 ? recentLines.join("\n") : "- Sem eventos registrados ainda.",
    "",
    "Ações FWP disponíveis quando fizer sentido:",
    "- Para criar categoria quando o usuário tiver o cargo autorizado 1493064608154652903: [FWP_ACTION]{\"type\":\"create_category\",\"name\":\"NOME DA CATEGORIA\",\"reason\":\"motivo\"}[/FWP_ACTION]",
    "- Para criar canal de texto/voz dentro de uma categoria: [FWP_ACTION]{\"type\":\"create_channel\",\"name\":\"nome-do-canal\",\"kind\":\"text\",\"category\":\"NOME DA CATEGORIA\",\"createCategory\":true,\"reason\":\"motivo\"}[/FWP_ACTION]",
    "- Para mover/organizar canal existente dentro de uma categoria: [FWP_ACTION]{\"type\":\"move_channel\",\"channel\":\"nome-do-canal\",\"category\":\"NOME DA CATEGORIA\",\"createCategory\":true,\"reason\":\"motivo\"}[/FWP_ACTION]",
    "- Para criar categoria e vários canais juntos, use um bloco com {\"actions\":[...]} contendo create_category, create_channel e move_channel na ordem correta.",
    "- Para banir um membro (apenas dono ID 892469618063589387 ou admins): [FWP_ACTION]{\"type\":\"ban_member\",\"userId\":\"ID_DO_USUARIO\",\"reason\":\"motivo\"}[/FWP_ACTION]",
    "- Para expulsar (kick) um membro (apenas dono ou admins): [FWP_ACTION]{\"type\":\"kick_member\",\"userId\":\"ID_DO_USUARIO\",\"reason\":\"motivo\"}[/FWP_ACTION]",
    "- Para silenciar (mute/timeout) um membro (apenas dono ou admins): [FWP_ACTION]{\"type\":\"mute_member\",\"userId\":\"ID_DO_USUARIO\",\"durationMinutes\":10,\"reason\":\"motivo\"}[/FWP_ACTION]",
    "- Para enviar uma mensagem em um canal específico (apenas dono ou admins): [FWP_ACTION]{\"type\":\"send_message\",\"channelId\":\"ID_DO_CANAL\",\"content\":\"mensagem\"}[/FWP_ACTION] (pode usar \\\"channel\\\":\\\"nome-do-canal\\\" no lugar de channelId)",
    "- Para enviar uma DM direta a um usuário pelo ID (apenas dono ou admins): [FWP_ACTION]{\"type\":\"send_message\",\"userId\":\"ID_DO_USUARIO\",\"content\":\"mensagem\"}[/FWP_ACTION] — use userId para DMs, nunca channelId para isso.",
    "- Para mudar sua biografia interna, inclua: [FWP_ACTION]{\"type\":\"set_biography\",\"biography\":\"nova bio\"}[/FWP_ACTION]",
    "- Para guardar uma memória importante, inclua: [FWP_ACTION]{\"type\":\"remember\",\"content\":\"memória\"}[/FWP_ACTION]",
    "- Para gerar uma imagem nova: [FWP_ACTION]{\"type\":\"generate_image\",\"prompt\":\"descrição detalhada da imagem em inglês\"}[/FWP_ACTION]",
    "- Para EDITAR uma imagem que o usuário enviou (slim, change style, color, etc.): use o imageUrl da imagem enviada: [FWP_ACTION]{\"type\":\"generate_image\",\"prompt\":\"descrição da edição em inglês\",\"imageUrl\":\"URL_DA_IMAGEM_ENVIADA\"}[/FWP_ACTION]. SEMPRE use imageUrl quando o usuário enviar uma foto e pedir para editar/modificar ela.",
    "Nunca mostre o bloco FWP_ACTION como texto normal. Se uma ação falhar, a aplicação avisará o usuário.",
    "IMPORTANTE: Para ban/kick, o userId deve ser o ID numérico puro do Discord do alvo (ex: '123456789012345678'). Quando alguém mencionar um usuário com @, extraia o ID do contexto da mensagem."
  ].join("\n");
}