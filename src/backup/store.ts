import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface BackupMeta {
  id: string;
  name: string;
  createdAt: string;
  file: string;
}

export interface BackupIndex {
  backups: BackupMeta[];
}

const DATA_DIR = path.join(process.cwd(), "data", "backups");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

export async function loadBackupIndex(): Promise<BackupIndex> {
  try {
    const raw = await readFile(INDEX_PATH, "utf8");
    return JSON.parse(raw) as BackupIndex;
  } catch {
    return { backups: [] };
  }
}

export async function saveBackupIndex(index: BackupIndex): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
}

export async function saveBackupFile(id: string, payload: unknown): Promise<string> {
  await mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${id}.json`);
  await writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

export async function loadBackupFile<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as T;
}
