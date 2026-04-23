import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";

const DATA_DIR = join(process.cwd(), "data");
const PROVIDER_FILE = join(DATA_DIR, "provider.json");

export type AIProvider = "ollama" | "gemini" | "gemini-v3" | "openai-v4" | "deepseek-v5" | "anthropic";

interface ProviderState {
  provider: AIProvider;
}

let cached: AIProvider | null = null;

async function ensureDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

const DEFAULT_PROVIDER: AIProvider = "openai-v4";

export async function getProvider(): Promise<AIProvider> {
  if (cached) return cached;
  try {
    const raw = await readFile(PROVIDER_FILE, "utf-8");
    const state: ProviderState = JSON.parse(raw);
    cached = state.provider ?? DEFAULT_PROVIDER;
  } catch {
    cached = DEFAULT_PROVIDER;
  }
  return cached;
}

export async function setProvider(provider: AIProvider): Promise<void> {
  await ensureDir();
  cached = provider;
  await writeFile(PROVIDER_FILE, JSON.stringify({ provider }, null, 2), "utf-8");
  logger.info({ provider }, "AI provider atualizado");
}
