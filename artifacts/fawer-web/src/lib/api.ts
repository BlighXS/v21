const BASE = "/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  provider: string;
  guestMessagesLeft: number | null;
  limitReached?: boolean;
}

export interface AuthUser {
  authenticated: boolean;
  guest: boolean;
  noSession?: boolean;
  guestId?: string;
  guestMessagesLeft?: number;
  discordId?: string;
  username?: string;
  globalName?: string;
  avatar?: string | null;
  isOwner?: boolean;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge: string;
  available: boolean;
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json() as Promise<AuthUser>;
}

export async function fetchModels(): Promise<Model[]> {
  const res = await fetch(`${BASE}/models`, { credentials: "include" });
  if (!res.ok) return [];
  const data = (await res.json()) as { models: Model[] };
  return data.models;
}

export async function sendChat(
  message: string,
  model: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message, model, history }),
  });

  if (res.status === 429) {
    const data = (await res.json()) as { error: string; limitReached: boolean };
    return { reply: data.error, provider: "", guestMessagesLeft: 0, limitReached: true };
  }

  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error || "Erro ao enviar mensagem.");
  }

  return res.json() as Promise<ChatResponse>;
}

export async function startGuestSession(): Promise<void> {
  await fetch(`${BASE}/auth/guest`, { method: "POST", credentials: "include" });
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" });
}

export function getDiscordLoginUrl(): string {
  return `${BASE}/auth/discord`;
}

export function getAvatarUrl(userId: string, avatarHash: string | null | undefined): string {
  if (!avatarHash) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 5}.png`;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`;
}
