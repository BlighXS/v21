import { GoogleGenAI } from "@google/genai";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";
import { recordMemorialEvent } from "./memorial.js";

const GEMINI_MODEL_DEFAULT = "gemini-2.5-flash";
export const GEMINI_MODEL_V3 = "gemini-3-flash-preview";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();

  if (!apiKey || !baseUrl) {
    throw new Error("Motor não configurado: integração Replit Gemini não encontrada.");
  }

  return new GoogleGenAI({ apiKey, httpOptions: { baseUrl, apiVersion: "" } });
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("ratelimit_exceeded") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function queryGemini(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string,
  model: string = GEMINI_MODEL_DEFAULT
): Promise<string> {
  const ai = getAiClient();

  const history = await loadUserMemory(memoryKey);

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }]
    })),
    { role: "user" as const, parts: [{ text: userQuery }] }
  ];

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
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
        metadata: { provider: "gemini", memoryKey, model, slot: "replit-integration" }
      });
      logger.info({ memoryKey, model, slot: "replit-integration" }, "Resposta Gemini gerada");
      return reply;

    } catch (err) {
      lastError = err;

      if (isRateLimitError(err)) {
        const delay = BASE_DELAY_MS * attempt;
        logger.warn({ attempt, delay, err: String(err) }, "Rate limit atingido, aguardando para tentar novamente");
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  logger.error({ attempts: MAX_RETRIES }, "Gemini falhou após todas as tentativas");
  throw new Error(`Gemini falhou após ${MAX_RETRIES} tentativas. Último erro: ${String(lastError)}`);
}
