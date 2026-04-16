import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";

const GEMINI_MODEL = "gemini-2.5-flash";

function collectKeys(): string[] {
  const keys: string[] = [];

  const base = process.env.GEMINI_API_KEY?.trim();
  if (base) keys.push(base);

  for (let i = 2; i <= 20; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (k) keys.push(k);
  }

  const replitKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  if (replitKey) keys.push(replitKey);

  return keys;
}

function isRetryableError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("api_key") ||
    msg.includes("expired") ||
    msg.includes("invalid")
  );
}

export async function queryGemini(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string
): Promise<string> {
  const keys = collectKeys();

  if (keys.length === 0) {
    throw new Error("Gemini não configurado: nenhuma GEMINI_API_KEY encontrada no faw.env.");
  }

  const history = await loadUserMemory(memoryKey);
  const chatHistory = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  let lastError: unknown;

  for (let i = 0; i < keys.length; i++) {
    const slot = i === keys.length - 1 && process.env.AI_INTEGRATIONS_GEMINI_API_KEY === keys[i]
      ? "replit-integration"
      : `key_${i + 1}`;

    try {
      const clientOpts: Record<string, unknown> = {};
      if (slot === "replit-integration" && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
        clientOpts.baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      }

      const genAI = new GoogleGenerativeAI(keys[i], clientOpts as any);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: systemPrompt
      });

      const chat = model.startChat({
        history: chatHistory,
        generationConfig: { maxOutputTokens: 8192 }
      });

      const result = await chat.sendMessage(userQuery);
      const reply = result.response.text().trim() || "Sem resposta gerada.";

      await appendToUserMemory(memoryKey, userQuery, reply);
      logger.info({ memoryKey, model: GEMINI_MODEL, slot }, "Resposta Gemini gerada");
      return reply;

    } catch (err) {
      lastError = err;
      if (isRetryableError(err)) {
        logger.warn({ slot, err: String(err) }, "Gemini key falhou, tentando próxima");
        continue;
      }
      throw err;
    }
  }

  logger.error({ keysCount: keys.length }, "Todas as Gemini keys falharam");
  throw new Error(`Todas as ${keys.length} Gemini key(s) falharam. Último erro: ${String(lastError)}`);
}
