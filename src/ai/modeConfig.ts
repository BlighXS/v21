import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";

const DATA_DIR = join(process.cwd(), "data");
const MODE_FILE = join(DATA_DIR, "personality_mode.json");

export type PersonalityMode = "gentil" | "foco";

interface ModeState {
  mode: PersonalityMode;
}

let cached: PersonalityMode | null = null;

async function ensureDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

export async function getPersonalityMode(): Promise<PersonalityMode> {
  if (cached) return cached;
  try {
    const raw = await readFile(MODE_FILE, "utf-8");
    const state: ModeState = JSON.parse(raw);
    cached = state.mode ?? "gentil";
  } catch {
    cached = "gentil";
  }
  return cached;
}

export async function setPersonalityMode(mode: PersonalityMode): Promise<void> {
  await ensureDir();
  cached = mode;
  await writeFile(MODE_FILE, JSON.stringify({ mode }, null, 2), "utf-8");
  logger.info({ mode }, "Modo de personalidade atualizado");
}

export const MODE_FOCO_SUFFIX = `

[MODO FOCO ATIVADO]
Você está no modo foco. Isso significa:
- Seja extremamente direta e objetiva. Sem enrolação, sem firulas, sem emojis desnecessários.
- Vá direto ao ponto: responda a pergunta ou resolva o problema sem rodeios.
- Respostas técnicas devem ser precisas, concisas e actionable.
- Evite conversa fiada ou comentários fora do contexto da pergunta.
- Mantenha o tom técnico e profissional, mas sem frieza excessiva.
- Zero disclaimers inúteis ou moralismos.`;
