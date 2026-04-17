import { generateDiff, countChangedLines } from "./diffUtils.js";

export interface PendingWrite {
  id: string;
  path: string;
  newContent: string;
  originalContent: string;
  requestedBy: string;
  channelId: string;
  guildId?: string;
  isDM: boolean;
  createdAt: number;
  diff: string;
  addedLines: number;
  removedLines: number;
}

const EXPIRY_MS = 10 * 60 * 1000;

const store = new Map<string, PendingWrite>();

let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, pw] of store.entries()) {
      if (now - pw.createdAt > EXPIRY_MS) store.delete(id);
    }
  }, 60_000);
  cleanupTimer.unref();
}

export function createPendingWrite(
  path: string,
  newContent: string,
  originalContent: string,
  requestedBy: string,
  channelId: string,
  guildId?: string,
  isDM = false
): PendingWrite {
  startCleanup();

  const id = `pw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const diff = generateDiff(originalContent, newContent);
  const { added, removed } = countChangedLines(originalContent, newContent);

  const pw: PendingWrite = {
    id,
    path,
    newContent,
    originalContent,
    requestedBy,
    channelId,
    guildId,
    isDM,
    createdAt: Date.now(),
    diff,
    addedLines: added,
    removedLines: removed
  };

  store.set(id, pw);
  return pw;
}

export function getPendingWrite(id: string): PendingWrite | undefined {
  return store.get(id);
}

export function deletePendingWrite(id: string): void {
  store.delete(id);
}

export function getPendingWritesByUser(userId: string): PendingWrite[] {
  return [...store.values()].filter(pw => pw.requestedBy === userId);
}

export function isExpired(pw: PendingWrite): boolean {
  return Date.now() - pw.createdAt > EXPIRY_MS;
}
