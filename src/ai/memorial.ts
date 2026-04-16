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
    "[ACESSO AO CÓDIGO FONTE]",
    "Você tem acesso de leitura e escrita ao próprio código fonte. Use as ações abaixo:",
    "- Para LER um arquivo: [FWP_ACTION]{\"type\":\"read_source_file\",\"path\":\"src/ai/memorial.ts\"}[/FWP_ACTION]",
    "  O conteúdo ficará disponível na memória operacional da próxima interação.",
    "- Para LISTAR arquivos de um diretório: [FWP_ACTION]{\"type\":\"list_source_files\",\"dir\":\"src/ai\"}[/FWP_ACTION]",
    "- Para ESCREVER/MODIFICAR um arquivo (apenas dono BlightG7): [FWP_ACTION]{\"type\":\"write_source_file\",\"path\":\"src/arquivo.ts\",\"content\":\"conteúdo completo aqui\"}[/FWP_ACTION]",
    "  Após modificar código, avise que o bot precisa ser reiniciado para aplicar as mudanças.",
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
    "- Para mudar sua biografia interna, inclua: [FWP_ACTION]{\"type\":\"set_biography\",\"biography\":\"nova bio\"}[/FWP_ACTION]",
    "- Para guardar uma memória importante, inclua: [FWP_ACTION]{\"type\":\"remember\",\"content\":\"memória\"}[/FWP_ACTION]",
    "- Para gerar e enviar uma imagem no canal (quando o usuário pedir uma imagem, arte, foto, ilustração, etc.): [FWP_ACTION]{\"type\":\"generate_image\",\"prompt\":\"descrição detalhada da imagem em inglês\"}[/FWP_ACTION]",
    "Nunca mostre o bloco FWP_ACTION como texto normal. Se uma ação falhar, a aplicação avisará o usuário.",
    "IMPORTANTE: Para ban/kick, o userId deve ser o ID numérico puro do Discord do alvo (ex: '123456789012345678'). Quando alguém mencionar um usuário com @, extraia o ID do contexto da mensagem."
  ].join("\n");
}