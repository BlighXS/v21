import { GoogleGenAI } from "@google/genai";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";
import { recordMemorialEvent } from "./memorial.js";

const GEMINI_MODEL_DEFAULT = "gemini-2.5-flash";
export const GEMINI_MODEL_V3 = "gemini-3-flash-preview";

function collectKeys(): Array<{ key: string; slot: string }> {
  const entries: Array<{ key: string; slot: string }> = [];

  const replitKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  const replitBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();
  if (replitKey && replitBase) {
    entries.push({ key: `replit::${replitKey}::${replitBase}`, slot: "replit-integration" });
  }

  const base = process.env.GEMINI_API_KEY?.trim();
  if (base) entries.push({ key: base, slot: "key_1" });

  for (let i = 2; i <= 20; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (k) entries.push({ key: k, slot: `key_${i}` });
  }

  return entries;
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
    msg.includes("api key") ||
    msg.includes("expired") ||
    msg.includes("invalid") ||
    msg.includes("not valid") ||
    msg.includes("not found") ||
    msg.includes("invalid_endpoint") ||
    msg.includes("endpoint")
  );
}

export async function queryGemini(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string,
  model: string = GEMINI_MODEL_DEFAULT
): Promise<string> {
  const keys = collectKeys();

  if (keys.length === 0) {
    throw new Error("Motor não configurado: nenhuma chave de processamento encontrada no faw.env.");
  }

  const history = await loadUserMemory(memoryKey);

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }]
    })),
    { role: "user" as const, parts: [{ text: userQuery }] }
  ];

  let lastError: unknown;

  for (const { key, slot } of keys) {
    try {
      let ai: GoogleGenAI;

      if (slot === "replit-integration") {
        const [, apiKey, baseUrl] = key.split("::");
        ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl, apiVersion: "" } });
      } else {
        ai = new GoogleGenAI({ apiKey: key });
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 8192
        }
      });

      const reply = response.text?.trim() || "Sem resposta gerada.";

      await appendToUserMemory(memoryKey, userQuery, reply);
      await recordMemorialEvent({
        type: "ai_response",
        content: reply,
        metadata: { provider: "gemini", memoryKey, model, slot }
      });
      logger.info({ memoryKey, model, slot }, "Resposta Gemini gerada");
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
  throw new Error(`Todas as ${keys.length} instância(s) do motor falharam. Último erro: ${String(lastError)}`);
}
