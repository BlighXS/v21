import { GoogleGenAI } from "@google/genai";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";
import { recordMemorialEvent } from "./memorial.js";

export const GEMINI_MODEL_V2 = "gemini-2.5-flash";
export const GEMINI_MODEL_V3 = "gemini-3-flash-preview";

const FALLBACK_CHAIN = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

const RETRY_DELAY_MS = 1500;

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

async function tryModel(
  ai: GoogleGenAI,
  model: string,
  systemPrompt: string,
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>
): Promise<string> {
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 8192,
    },
  });
  return response.text?.trim() || "Sem resposta gerada.";
}

export async function queryGemini(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string,
  preferredModel: string = GEMINI_MODEL_V3
): Promise<string> {
  const ai = getAiClient();
  const history = await loadUserMemory(memoryKey);

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: userQuery }] },
  ];

  // Build the model chain: start with the preferred model, then fall back
  const chain = [
    preferredModel,
    ...FALLBACK_CHAIN.filter((m) => m !== preferredModel),
  ];

  let lastError: unknown;

  for (const model of chain) {
    // Try each model up to 2 times with a short delay
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const reply = await tryModel(ai, model, systemPrompt, contents);

        await appendToUserMemory(memoryKey, userQuery, reply);
        await recordMemorialEvent({
          type: "ai_response",
          content: reply,
          metadata: { provider: "gemini", memoryKey, model },
        });
        logger.info({ memoryKey, model }, "Resposta Gemini gerada");
        return reply;
      } catch (err) {
        lastError = err;
        if (isRateLimitError(err)) {
          logger.warn({ model, attempt }, "Rate limit no modelo, tentando próximo");
          if (attempt < 2) await sleep(RETRY_DELAY_MS);
          break; // move to next model in chain
        }
        throw err; // non-rate-limit error: propagate immediately
      }
    }
  }

  logger.error({ chain }, "Todos os modelos Gemini falharam");
  throw new Error(`Todos os modelos Gemini falharam. Último erro: ${String(lastError)}`);
}
