import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Guild, Message } from "discord.js";

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
  biography: "Fawers é a IA operacional do servidor FAW: direta, técnica, memoriosa e consciente das ações que executa no servidor.",
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

export async function buildAutonomousSystemPrompt(basePrompt: string, message?: Message): Promise<string> {
  const profile = await loadBotProfile();
  const recent = await loadRecentMemorial();
  const recentLines = recent.map((event) => {
    const who = event.username ? ` por ${event.username}` : "";
    return `- [${event.timestamp}] ${event.type}${who}: ${event.content}`;
  });

  return [
    basePrompt.trim(),
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
    "- Para mudar sua biografia interna, inclua: [FWP_ACTION]{\"type\":\"set_biography\",\"biography\":\"nova bio\"}[/FWP_ACTION]",
    "- Para guardar uma memória importante, inclua: [FWP_ACTION]{\"type\":\"remember\",\"content\":\"memória\"}[/FWP_ACTION]",
    "Nunca mostre o bloco FWP_ACTION como texto normal. Se uma ação falhar, a aplicação avisará o usuário."
  ].join("\n");
}