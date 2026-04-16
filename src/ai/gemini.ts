import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";

const GEMINI_MODEL = "gemini-2.5-flash";

function getClient(): GoogleGenerativeAI {
  const direct = process.env.GEMINI_API_KEY;
  if (direct) {
    return new GoogleGenerativeAI(direct);
  }
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  if (apiKey && baseUrl) {
    return new GoogleGenerativeAI(apiKey, { baseUrl } as any);
  }
  throw new Error("Gemini não configurado: defina GEMINI_API_KEY no faw.env.");
}

export async function queryGemini(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string
): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt
  });

  const history = await loadUserMemory(memoryKey);
  const chatHistory = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const chat = model.startChat({
    history: chatHistory,
    generationConfig: { maxOutputTokens: 8192 }
  });

  const result = await chat.sendMessage(userQuery);
  const reply = result.response.text().trim() || "Sem resposta gerada.";

  await appendToUserMemory(memoryKey, userQuery, reply);
  logger.info({ memoryKey, model: GEMINI_MODEL }, "Resposta Gemini gerada");
  return reply;
}
