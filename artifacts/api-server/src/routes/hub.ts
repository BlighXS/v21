import { Router } from "express";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const router = Router();

const MEMORY_DIR = process.env.MEMORY_DIR
  ? process.env.MEMORY_DIR
  : join(process.cwd(), "../../data/memory");
const BOT_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.DASHBOARD_GUILD_ID || "";
// Acesso público ao Hub: quem tem o site, tem o painel.

interface MemoryEntry {
  role: string;
  content: string;
  timestamp?: string;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string;
}

interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  author: DiscordUser;
  attachments?: Array<{ url: string; filename?: string; content_type?: string }>;
}

async function discordRequest(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      ...options.headers,
    },
  });
}

async function openDmChannel(userId: string): Promise<string> {
  const res = await discordRequest("/users/@me/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao abrir canal DM: ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

// ─── Caches ───────────────────────────────────────────────────────────
let botIdCache: string | null = null;
async function getBotId(): Promise<string> {
  if (botIdCache) return botIdCache;
  const res = await discordRequest("/users/@me");
  if (!res.ok) return "";
  const data = (await res.json()) as DiscordUser;
  botIdCache = data.id;
  return data.id;
}

const userInfoCache = new Map<string, { data: DiscordUser; ts: number }>();
const USER_TTL = 5 * 60 * 1000;
async function fetchUserInfo(userId: string): Promise<DiscordUser | null> {
  const cached = userInfoCache.get(userId);
  if (cached && Date.now() - cached.ts < USER_TTL) return cached.data;
  try {
    const res = await discordRequest(`/users/${userId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as DiscordUser;
    userInfoCache.set(userId, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}

interface GuildMember {
  user: DiscordUser;
  nick?: string | null;
  joined_at?: string;
}
let guildMembersCache: { members: GuildMember[]; ts: number } | null = null;
const GUILD_TTL = 60 * 1000;
async function fetchGuildMembers(): Promise<GuildMember[]> {
  if (!GUILD_ID || !BOT_TOKEN) return [];
  if (guildMembersCache && Date.now() - guildMembersCache.ts < GUILD_TTL) {
    return guildMembersCache.members;
  }
  const all: GuildMember[] = [];
  let after = "0";
  for (let page = 0; page < 10; page++) {
    const res = await discordRequest(`/guilds/${GUILD_ID}/members?limit=1000&after=${after}`);
    if (!res.ok) break;
    const batch = (await res.json()) as GuildMember[];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user.id;
  }
  guildMembersCache = { members: all, ts: Date.now() };
  for (const m of all) {
    userInfoCache.set(m.user.id, { data: m.user, ts: Date.now() });
  }
  return all;
}

function avatarUrl(u: DiscordUser | null | undefined, size = 64): string | null {
  if (!u) return null;
  if (!u.avatar) {
    const idx = u.discriminator && u.discriminator !== "0"
      ? Number(u.discriminator) % 5
      : Number((BigInt(u.id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  const ext = u.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${ext}?size=${size}`;
}

function displayName(u: DiscordUser | null | undefined, nick?: string | null): string {
  if (nick) return nick;
  return u?.global_name || u?.username || "?";
}

// ─── Routes ───────────────────────────────────────────────────────────

router.get("/users", async (_req, res) => {
  try {
    // 1. memory users
    let memoryFiles: string[] = [];
    try {
      const files = await readdir(MEMORY_DIR);
      memoryFiles = files.filter(
        (f) => f.endsWith(".json") && /^\d+\.json$/.test(f),
      );
    } catch {
      memoryFiles = [];
    }

    const memMap = new Map<string, { messageCount: number; lastActivity: string | null; lastPreview: string | null }>();
    await Promise.all(
      memoryFiles.map(async (file) => {
        const userId = file.replace(".json", "");
        try {
          const raw = await readFile(join(MEMORY_DIR, file), "utf-8");
          const messages: MemoryEntry[] = JSON.parse(raw);
          const lastMsg = messages[messages.length - 1];
          const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
          memMap.set(userId, {
            messageCount: messages.length,
            lastActivity: lastMsg?.timestamp ?? null,
            lastPreview: lastUserMsg?.content?.replace(/^\[Canal:[^\]]+\]\s*/, "").slice(0, 80) ?? null,
          });
        } catch {
          memMap.set(userId, { messageCount: 0, lastActivity: null, lastPreview: null });
        }
      }),
    );

    // 2. guild members
    const members = await fetchGuildMembers();
    const botId = await getBotId();

    // 3. merge
    const seen = new Set<string>();
    const result: Array<{
      userId: string;
      name: string;
      avatar: string | null;
      messageCount: number;
      lastActivity: string | null;
      lastPreview: string | null;
      inGuild: boolean;
      hasMemory: boolean;
    }> = [];

    for (const [userId, mem] of memMap) {
      if (userId === botId) continue;
      const member = members.find((m) => m.user.id === userId);
      const userInfo = member?.user ?? (await fetchUserInfo(userId));
      seen.add(userId);
      result.push({
        userId,
        name: displayName(userInfo, member?.nick),
        avatar: avatarUrl(userInfo),
        messageCount: mem.messageCount,
        lastActivity: mem.lastActivity,
        lastPreview: mem.lastPreview,
        inGuild: !!member,
        hasMemory: true,
      });
    }

    for (const m of members) {
      if (seen.has(m.user.id)) continue;
      if (m.user.id === botId) continue;
      result.push({
        userId: m.user.id,
        name: displayName(m.user, m.nick),
        avatar: avatarUrl(m.user),
        messageCount: 0,
        lastActivity: null,
        lastPreview: null,
        inGuild: true,
        hasMemory: false,
      });
    }

    // sort: hasMemory first by lastActivity desc, then by name
    result.sort((a, b) => {
      if (a.hasMemory && !b.hasMemory) return -1;
      if (!a.hasMemory && b.hasMemory) return 1;
      if (a.hasMemory && b.hasMemory) {
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      }
      return a.name.localeCompare(b.name);
    });

    res.json({ users: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/conversation/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    // 1. memory
    let memMessages: MemoryEntry[] = [];
    try {
      const filePath = join(MEMORY_DIR, `${userId}.json`);
      const raw = await readFile(filePath, "utf-8");
      memMessages = JSON.parse(raw);
    } catch {
      memMessages = [];
    }

    // 2. real Discord DM history
    let dmMessages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: string;
      attachments: Array<{ url: string; filename?: string; type?: string }>;
      source: "discord";
    }> = [];

    if (BOT_TOKEN) {
      try {
        const channelId = await openDmChannel(userId);
        const botId = await getBotId();
        const msgRes = await discordRequest(`/channels/${channelId}/messages?limit=100`);
        if (msgRes.ok) {
          const msgs = (await msgRes.json()) as DiscordMessage[];
          dmMessages = msgs.map((m) => ({
            id: m.id,
            role: m.author.id === botId ? "assistant" : "user",
            content: m.content || "",
            timestamp: m.timestamp,
            attachments: (m.attachments || []).map((a) => ({
              url: a.url,
              filename: a.filename,
              type: a.content_type,
            })),
            source: "discord" as const,
          }));
        }
      } catch {
        // ignore — bot may not share DMs with this user yet
      }
    }

    // 3. merge: avoid duplicates between memory entries & discord DMs
    // Memory entries don't have IDs, so dedupe by (role + normalized content + timestamp ~minute)
    const norm = (s: string) => s.replace(/^\[Canal:[^\]]+\][^]*?\n*/, "").trim().slice(0, 200);
    const dmKeys = new Set(
      dmMessages.map((d) => `${d.role}|${norm(d.content)}|${d.timestamp.slice(0, 16)}`),
    );

    const combined: Array<{
      id?: string;
      role: string;
      content: string;
      timestamp: string;
      attachments?: Array<{ url: string; filename?: string; type?: string }>;
      source: "memory" | "discord";
    }> = [];

    for (const m of memMessages) {
      const key = `${m.role}|${norm(m.content)}|${(m.timestamp ?? "").slice(0, 16)}`;
      if (dmKeys.has(key)) continue;
      combined.push({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp ?? new Date(0).toISOString(),
        source: "memory",
      });
    }
    for (const d of dmMessages) {
      combined.push(d);
    }

    combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // user info for header
    const userInfo = await fetchUserInfo(userId);

    res.json({
      userId,
      name: displayName(userInfo),
      avatar: avatarUrl(userInfo),
      messages: combined,
      memoryCount: memMessages.length,
      dmCount: dmMessages.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/dm", async (req, res) => {
  const { userId, content } = req.body as { userId?: string; content?: string };

  if (!userId?.trim() || !content?.trim()) {
    res.status(400).json({ error: "userId e content são obrigatórios." });
    return;
  }
  if (!BOT_TOKEN) {
    res.status(500).json({ error: "Token do bot não configurado." });
    return;
  }

  try {
    const channelId = await openDmChannel(userId);
    const msgRes = await discordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!msgRes.ok) {
      const text = await msgRes.text();
      res.status(500).json({ error: `Falha ao enviar mensagem: ${text}` });
      return;
    }

    const msg = (await msgRes.json()) as { id: string };
    res.json({ success: true, messageId: msg.id });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/dm/image", async (req, res) => {
  const { userId, base64, filename, caption } = req.body as {
    userId?: string;
    base64?: string;
    filename?: string;
    caption?: string;
  };

  if (!userId?.trim() || !base64?.trim()) {
    res.status(400).json({ error: "userId e base64 são obrigatórios." });
    return;
  }
  if (!BOT_TOKEN) {
    res.status(500).json({ error: "Token do bot não configurado." });
    return;
  }

  try {
    const channelId = await openDmChannel(userId);

    const imgBuffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    const name = filename || "imagem.png";

    const form = new FormData();
    const blob = new Blob([imgBuffer]);
    form.append("files[0]", blob, name);

    if (caption?.trim()) {
      form.append("payload_json", JSON.stringify({ content: caption }));
    }

    const msgRes = await discordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: form,
    });

    if (!msgRes.ok) {
      const text = await msgRes.text();
      res.status(500).json({ error: `Falha ao enviar imagem: ${text}` });
      return;
    }

    const msg = (await msgRes.json()) as { id: string };
    res.json({ success: true, messageId: msg.id });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
