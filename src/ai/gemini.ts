import { GoogleGenAI } from "@google/genai";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";
import { recordMemorialEvent } from "./memorial.js";

export const GEMINI_MODEL_V2 = "gemini-2.5-flash";
export const GEMINI_MODEL_V3 = "gemini-3-flash-preview";

const FALLBACK_CHAIN = ["gemini-3-flash-preview", "gemini-2.5-flash"];

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();

  if (!apiKey || !baseUrl) {
    throw new Error("Motor não configurado: integração Replit Gemini não encontrada.");
  }

  return new GoogleGenAI({ apiKey, httpOptions: { baseUrl, apiVersion: "" } });
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

  for (const model of chain) {
    try {
      const reply = await tryModel(ai, model, systemPrompt, contents);
      if (model !== preferredModel) {
        logger.warn({ fromModel: preferredModel, toModel: model }, "Modelo Gemini trocado");
      }
      await appendToUserMemory(memoryKey, userQuery, reply);
      await recordMemorialEvent({
        type: "ai_response",
        content: reply,
        metadata: { provider: "gemini", memoryKey, model },
      });
      logger.info({ memoryKey, model }, "Resposta Gemini gerada");
      return reply;
    } catch (err) {
      logger.warn({ model, err: String(err) }, "Modelo Gemini falhou");
    }
  }

  logger.error({ chain }, "Todos os modelos Gemini falharam");
  throw new Error("Todos os modelos Gemini falharam.");
}
