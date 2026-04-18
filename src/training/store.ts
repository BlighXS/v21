import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BASE_IDENTITY, TRAINING_QUESTIONS } from "./identity.js";
import { logger } from "../utils/logger.js";

export type TrainingAnswers = Record<string, string>;

export interface TrainingData {
  baseIdentity: string;
  answers: TrainingAnswers;
  compiledIdentity: string;
  lastUpdatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "training.json");

const MAX_ANSWER_LENGTH = 1000;
const MAX_TOTAL_SIZE = 10000;

function sanitizeAnswers(input: TrainingAnswers): TrainingAnswers {
  const output: TrainingAnswers = {};
  let totalSize = 0;

  for (const q of TRAINING_QUESTIONS) {
    const raw = input[q.id];
    if (!raw || typeof raw !== "string") continue;

    const cleaned = raw.trim().slice(0, MAX_ANSWER_LENGTH);
    totalSize += cleaned.length;

    if (totalSize > MAX_TOTAL_SIZE) {
      logger.warn("Limite total de respostas excedido, truncando");
      break;
    }

    output[q.id] = cleaned;
  }

  return output;
}

export function compileIdentity(
  base: string,
  answers: TrainingAnswers,
): string {
  const lines: string[] = [base.trim(), "", "Perfil atual (treinamento):"];

  for (const q of TRAINING_QUESTIONS) {
    const answer = answers[q.id];
    if (!answer) continue;

    lines.push(`- ${q.text}`);
    lines.push(`  ${answer}`);
  }

  return lines.join("\n").trim();
}

export async function loadTrainingData(): Promise<TrainingData> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<TrainingData>;

    const answers = sanitizeAnswers(parsed.answers ?? {});
    const compiledIdentity = compileIdentity(BASE_IDENTITY, answers);

    return {
      baseIdentity: BASE_IDENTITY,
      answers,
      compiledIdentity,
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.error({ error }, "training.json corrompido, resetando");
    }

    const compiledIdentity = compileIdentity(BASE_IDENTITY, {});

    return {
      baseIdentity: BASE_IDENTITY,
      answers: {},
      compiledIdentity,
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

export async function saveTrainingData(
  answers: TrainingAnswers,
): Promise<TrainingData> {
  await mkdir(DATA_DIR, { recursive: true });

  const safeAnswers = sanitizeAnswers(answers);
  const compiledIdentity = compileIdentity(BASE_IDENTITY, safeAnswers);

  const data: TrainingData = {
    baseIdentity: BASE_IDENTITY,
    answers: safeAnswers,
    compiledIdentity,
    lastUpdatedAt: new Date().toISOString(),
  };

  const tempPath = `${DATA_PATH}.tmp`;

  // escrita atômica (evita corrupção)
  await writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");

  return data;
}

export async function buildTrainingPrompt(userQuery: string): Promise<string> {
  const data = await loadTrainingData();

  const identity = data.compiledIdentity || data.baseIdentity;

  const safeQuery = String(userQuery).slice(0, 2000);

  return `${identity}\n\nPergunta do usuario: ${safeQuery}`.trim();
}
