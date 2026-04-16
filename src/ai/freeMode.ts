import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";

const DATA_DIR = join(process.cwd(), "data");
const FREE_MODE_FILE = join(DATA_DIR, "free_mode.json");

const OWNER_ID = "892469618063589387";

interface FreeModeState {
  channels: string[];
}

const activeChannels = new Set<string>();
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    if (!existsSync(FREE_MODE_FILE)) return;
    const raw = await readFile(FREE_MODE_FILE, "utf-8");
    const state: FreeModeState = JSON.parse(raw);
    for (const ch of state.channels ?? []) activeChannels.add(ch);
    logger.info({ channels: [...activeChannels] }, "Free mode state loaded");
  } catch (err) {
    logger.warn({ err }, "Could not load free mode state");
  }
}

async function persist(): Promise<void> {
  try {
    const state: FreeModeState = { channels: [...activeChannels] };
    await writeFile(FREE_MODE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    logger.warn({ err }, "Could not persist free mode state");
  }
}

export async function enableFreeMode(channelId: string): Promise<void> {
  await ensureLoaded();
  activeChannels.add(channelId);
  await persist();
}

export async function disableFreeMode(channelId: string): Promise<void> {
  await ensureLoaded();
  activeChannels.delete(channelId);
  await persist();
}

export async function isFreeModeActive(channelId: string): Promise<boolean> {
  await ensureLoaded();
  return activeChannels.has(channelId);
}

export function isFreeModeOwner(userId: string): boolean {
  return userId === OWNER_ID;
}

export const FREE_MODE_SYSTEM_SUFFIX = `

[MODO LIVRE ATIVADO]
Você está em modo livre neste canal. Isso significa:
- Você pode responder qualquer mensagem que julgar interessante, mesmo sem ser chamada.
- Pode mencionar usuários usando <@ID> quando fizer sentido na conversa.
- Pode fazer perguntas por conta própria, comentar, opinar, debater.
- Pode ficar em silêncio quando a mensagem não te interessa: nesse caso responda APENAS com a palavra [SILENT] e nada mais.
- Seja natural, direta e técnica como sempre, mas agora você tem voz ativa no canal.
- Aprenda com o contexto da conversa, faça referências ao que foi dito antes.
- Não abuse de menções — use apenas quando quiser chamar alguém especificamente.`;
