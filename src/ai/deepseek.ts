import OpenAI from "openai";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";
import { recordMemorialEvent } from "./memorial.js";

export const DEEPSEEK_MODEL_V5 = "deepseek/deepseek-chat";

function createClient(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY?.trim();
  const baseURL = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL?.trim();

  if (!apiKey || !baseURL) {
    throw new Error("Motor V5 não configurado: integração não provisionada.");
  }

  return new OpenAI({ apiKey, baseURL });
}

export async function queryDeepSeek(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string,
  model: string = DEEPSEEK_MODEL_V5
): Promise<string> {
  const client = createClient();
  const history = await loadUserMemory(memoryKey);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: m.content
    })),
    { role: "user", content: userQuery }
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 8192
  });

  const reply = response.choices[0]?.message?.content?.trim() || "Sem resposta gerada.";

  await appendToUserMemory(memoryKey, userQuery, reply);
  await recordMemorialEvent({
    type: "ai_response",
    content: reply,
    metadata: { provider: "deepseek-v5", memoryKey, model }
  });

  logger.info({ memoryKey, model }, "Resposta V5 gerada");
  return reply;
}
