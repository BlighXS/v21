import { mkdir, readFile, readdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const MEMORY_DIR = path.join(process.cwd(), "data", "memory");
const MAX_HISTORY = 24;

export function resolveMemoryKey(userId: string): string {
  return userId;
}

export async function loadUserMemory(userId: string): Promise<ChatMessage[]> {
  try {
    const raw = await readFile(path.join(MEMORY_DIR, `${userId}.json`), "utf8");
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function saveUserMemory(userId: string, history: ChatMessage[]): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
  const trimmed = history.slice(-MAX_HISTORY);
  await writeFile(path.join(MEMORY_DIR, `${userId}.json`), JSON.stringify(trimmed, null, 2), "utf8");
}

export async function appendToUserMemory(
  userId: string,
  userMsg: string,
  botMsg: string
): Promise<ChatMessage[]> {
  const history = await loadUserMemory(userId);
  history.push({ role: "user", content: userMsg, timestamp: new Date().toISOString() });
  history.push({ role: "assistant", content: botMsg, timestamp: new Date().toISOString() });
  await saveUserMemory(userId, history);
  return history;
}

export async function clearUserMemory(userId: string): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
  await writeFile(path.join(MEMORY_DIR, `${userId}.json`), "[]", "utf8");
}

export async function migrateMemoryKeys(): Promise<void> {
  try {
    await mkdir(MEMORY_DIR, { recursive: true });
    const files = await readdir(MEMORY_DIR);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const base = file.slice(0, -5);

      if (base.startsWith("dm_")) {
        const userId = base.slice(3);
        if (!userId) continue;

        const oldPath = path.join(MEMORY_DIR, file);
        const newPath = path.join(MEMORY_DIR, `${userId}.json`);

        try {
          const oldRaw = await readFile(oldPath, "utf8");
          const oldHistory = JSON.parse(oldRaw) as ChatMessage[];
          if (oldHistory.length === 0) {
            await rename(oldPath, `${oldPath}.migrated`);
            continue;
          }

          let newHistory: ChatMessage[] = [];
          try {
            const newRaw = await readFile(newPath, "utf8");
            newHistory = JSON.parse(newRaw) as ChatMessage[];
          } catch {
            newHistory = [];
          }

          const merged = [...oldHistory, ...newHistory]
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            .slice(-MAX_HISTORY);

          await writeFile(newPath, JSON.stringify(merged, null, 2), "utf8");
          await rename(oldPath, `${oldPath}.migrated`);
        } catch {
          continue;
        }
      }
    }
  } catch {
  }
}
