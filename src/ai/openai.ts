import OpenAI from "openai";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";
import { recordMemorialEvent } from "./memorial.js";

export const OPENAI_MODEL_V4 = "gpt-5.2";

function createClient(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();

  if (!apiKey || !baseURL) {
    throw new Error("Motor V4 não configurado: integração OpenAI não provisionada.");
  }

  return new OpenAI({ apiKey, baseURL });
}

export async function queryOpenAI(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string,
  model: string = OPENAI_MODEL_V4
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
    max_completion_tokens: 8192
  });

  const reply = response.choices[0]?.message?.content?.trim() || "Sem resposta gerada.";

  await appendToUserMemory(memoryKey, userQuery, reply);
  await recordMemorialEvent({
    type: "ai_response",
    content: reply,
    metadata: { provider: "openai", memoryKey, model }
  });

  logger.info({ memoryKey, model }, "Resposta OpenAI V4 gerada");
  return reply;
}
