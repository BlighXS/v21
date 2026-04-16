import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BASE_IDENTITY, TRAINING_QUESTIONS } from "./identity.js";

export type TrainingAnswers = Record<string, string>;

export interface TrainingData {
  baseIdentity: string;
  answers: TrainingAnswers;
  compiledIdentity: string;
  lastUpdatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "training.json");

export function compileIdentity(base: string, answers: TrainingAnswers): string {
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
    const parsed = JSON.parse(raw) as TrainingData;
    const answers = parsed.answers ?? {};
    // Always recompile with the current BASE_IDENTITY from code
    const compiledIdentity = compileIdentity(BASE_IDENTITY, answers);
    return {
      baseIdentity: BASE_IDENTITY,
      answers,
      compiledIdentity,
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString()
    };
  } catch {
    const compiledIdentity = compileIdentity(BASE_IDENTITY, {});
    return {
      baseIdentity: BASE_IDENTITY,
      answers: {},
      compiledIdentity,
      lastUpdatedAt: new Date().toISOString()
    };
  }
}

export async function saveTrainingData(answers: TrainingAnswers): Promise<TrainingData> {
  await mkdir(DATA_DIR, { recursive: true });
  const compiledIdentity = compileIdentity(BASE_IDENTITY, answers);
  const data: TrainingData = {
    baseIdentity: BASE_IDENTITY,
    answers,
    compiledIdentity,
    lastUpdatedAt: new Date().toISOString()
  };
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  return data;
}

export async function buildTrainingPrompt(userQuery: string): Promise<string> {
  const data = await loadTrainingData();
  const identity = data.compiledIdentity || data.baseIdentity;
  return `${identity}\n\nPergunta do usuario: ${userQuery}`.trim();
}
