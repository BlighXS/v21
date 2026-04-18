import { Router, type Request, type Response, type NextFunction } from "express";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { getSession } from "../lib/session.js";

const router = Router();

const MEMORY_DIR = join(process.cwd(), "../../data/memory");
const BOT_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || "";
const OWNER_IDS = (process.env.OWNER_IDS || process.env.OWNER_ID || "892469618063589387")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (!session || session.type !== "discord") {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }
  if (!OWNER_IDS.includes(session.discordId ?? "")) {
    res.status(403).json({ error: "Acesso negado. Apenas o dono do Hub pode usar isso." });
    return;
  }
  next();
}

interface MemoryEntry {
  role: string;
  content: string;
  timestamp?: string;
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

router.get("/users", requireOwner, async (_req, res) => {
  try {
    const files = await readdir(MEMORY_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json") && !f.startsWith("global") && !f.startsWith("provider"));

    const users = await Promise.all(
      jsonFiles.map(async (file) => {
        const userId = file.replace(".json", "");
        try {
          const raw = await readFile(join(MEMORY_DIR, file), "utf-8");
          const messages: MemoryEntry[] = JSON.parse(raw);
          const lastMsg = messages[messages.length - 1];
          const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
          return {
            userId,
            messageCount: messages.length,
            lastActivity: lastMsg?.timestamp ?? null,
            lastPreview: lastUserMsg?.content?.slice(0, 80) ?? null,
          };
        } catch {
          return { userId, messageCount: 0, lastActivity: null, lastPreview: null };
        }
      })
    );

    users.sort((a, b) => {
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/conversation/:userId", requireOwner, async (req, res) => {
  try {
    const filePath = join(MEMORY_DIR, `${req.params.userId}.json`);
    const raw = await readFile(filePath, "utf-8");
    const messages: MemoryEntry[] = JSON.parse(raw);
    res.json({ userId: req.params.userId, messages });
  } catch {
    res.status(404).json({ error: "Usuário não encontrado." });
  }
});

router.post("/dm", requireOwner, async (req, res) => {
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

router.post("/dm/image", requireOwner, async (req, res) => {
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
