import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const MEMORY_DIR = path.join(process.cwd(), "data", "memory");
const MAX_HISTORY = 20;

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
