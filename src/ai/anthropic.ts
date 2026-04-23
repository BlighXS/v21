import Anthropic from "@anthropic-ai/sdk";
import { loadUserMemory, appendToUserMemory } from "./memory.js";
import { logger } from "../utils/logger.js";
import { recordMemorialEvent } from "./memorial.js";

export const ANTHROPIC_MODEL_PRIMARY = "claude-sonnet-4-6";
export const ANTHROPIC_MODEL_FAST = "claude-haiku-4-5";

const FALLBACK_CHAIN = [ANTHROPIC_MODEL_PRIMARY, ANTHROPIC_MODEL_FAST];

function createClient(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY?.trim();
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL?.trim();
  if (!apiKey || !baseURL) {
    throw new Error("Motor Anthropic não configurado: integração não provisionada.");
  }
  return new Anthropic({ apiKey, baseURL });
}

export async function queryAnthropic(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string,
  preferredModel: string = ANTHROPIC_MODEL_PRIMARY
): Promise<string> {
  const client = createClient();
  const history = await loadUserMemory(memoryKey);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
    { role: "user" as const, content: userQuery },
  ];

  const chain = [preferredModel, ...FALLBACK_CHAIN.filter((m) => m !== preferredModel)];

  let lastErr: unknown;
  for (const model of chain) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages,
      });
      const block = resp.content[0];
      const reply = (block && block.type === "text" ? block.text : "").trim() || "Sem resposta gerada.";

      await appendToUserMemory(memoryKey, userQuery, reply);
      await recordMemorialEvent({
        type: "ai_response",
        content: reply,
        metadata: { provider: "anthropic", memoryKey, model },
      });
      logger.info({ memoryKey, model }, "Resposta Anthropic gerada");
      return reply;
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err: String(err) }, "Modelo Anthropic falhou");
    }
  }

  throw new Error(`Todos os modelos Anthropic falharam. Último: ${String(lastErr)}`);
}
