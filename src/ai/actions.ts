import { ActivityType, ChannelType, PermissionsBitField } from "discord.js";
import type { Message } from "discord.js";
import { addBotPreference, recordMessageEvent, updateBotBiography } from "./memorial.js";

const CHANNEL_CREATOR_ROLE_ID = "1493064608154652903";

type FwpAction =
  | { type: "create_channel"; name?: string; kind?: "text" | "voice" | "category"; reason?: string }
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
      actions.push({ type: "remember", content: `A IA tentou emitir uma ação inválida: ${match[1].trim().slice(0, 500)}` });
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

async function executeCreateChannel(message: Message, action: Extract<FwpAction, { type: "create_channel" }>): Promise<string> {
  if (!message.guild) return "Não consegui criar canal: mensagem fora de servidor.";
  if (!canCreateChannels(message)) return `Não criei canal: apenas usuários com o cargo <@&${CHANNEL_CREATOR_ROLE_ID}> ou administradores podem pedir isso pelo FWP.`;

  const me = message.guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return "Não consegui criar canal: o bot não tem permissão Gerenciar Canais.";
  }

  const name = normalizeChannelName(action.name || "novo-canal");
  const kind = action.kind || "text";
  const type = kind === "voice" ? ChannelType.GuildVoice : kind === "category" ? ChannelType.GuildCategory : ChannelType.GuildText;
  const created = await message.guild.channels.create({
    name,
    type,
    reason: action.reason || `Criado via FWP por ${message.author.tag}`
  });

  await recordMessageEvent("ai_action", message, `Canal criado via FWP: ${created.name} (${created.id})`, {
    action: "create_channel",
    channelId: created.id,
    requestedName: action.name,
    kind
  });

  return `Canal criado: <#${created.id}>.`;
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
      if (!["create_channel", "set_biography", "remember"].includes(action.type)) {
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