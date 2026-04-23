import type { AIProvider } from "./providerConfig.js";
import { queryGemini, GEMINI_MODEL_V2, GEMINI_MODEL_V3 } from "./gemini.js";
import { queryOpenAI } from "./openai.js";
import { queryDeepSeek } from "./deepseek.js";
import { logger } from "../utils/logger.js";

const CLOUD_CHAIN: AIProvider[] = ["gemini-v3", "deepseek-v5", "gemini", "openai-v4"];

function isContextError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("maximum context length") ||
    msg.includes("context length") ||
    msg.includes("requested about") ||
    msg.includes("context window") ||
    msg.includes("too long")
  );
}

function isTransientError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("rate limit") ||
    msg.includes("429")
  );
}

function isQuotaError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("free tier monthly spend limit exceeded") ||
    msg.includes("budget exceeded") ||
    msg.includes("quota exceeded") ||
    msg.includes("403")
  );
}

async function queryWithProvider(
  provider: AIProvider,
  systemPrompt: string,
  memoryKey: string,
  userQuery: string
): Promise<string> {
  switch (provider) {
    case "gemini-v3":
      return queryGemini(systemPrompt, memoryKey, userQuery, GEMINI_MODEL_V3);
    case "gemini":
      return queryGemini(systemPrompt, memoryKey, userQuery, GEMINI_MODEL_V2);
    case "openai-v4":
      return queryOpenAI(systemPrompt, memoryKey, userQuery);
    case "deepseek-v5":
      return queryDeepSeek(systemPrompt, memoryKey, userQuery);
    default:
      throw new Error(`Provider não suportado no fallback: ${provider}`);
  }
}

export async function queryWithFallback(
  primaryProvider: AIProvider,
  systemPrompt: string,
  memoryKey: string,
  userQuery: string
): Promise<string> {
  const chain: AIProvider[] = primaryProvider === "ollama"
    ? ["ollama", ...CLOUD_CHAIN]
    : [primaryProvider, ...CLOUD_CHAIN.filter((p) => p !== primaryProvider), "ollama"];

  let lastError: unknown;

  for (const provider of chain) {
    try {
      const result = await queryWithProvider(provider, systemPrompt, memoryKey, userQuery);
      if (provider !== primaryProvider) {
        logger.warn({ primaryProvider, usedProvider: provider }, "Motor trocado automaticamente no fallback");
      }
      return result;
    } catch (err) {
      lastError = err;

      if (isQuotaError(err) && provider !== "ollama") {
        logger.warn({ provider, err: String(err) }, "Fallback: limite/quota do cloud atingido, tentando Ollama local");
        continue;
      }

      if (isContextError(err)) {
        logger.warn({ provider, err: String(err) }, "Fallback: contexto muito grande, pulando para o próximo motor");
        continue;
      }

      if (isTransientError(err)) {
        logger.warn({ provider, err: String(err) }, "Fallback: motor sobrecarregado, tentando próximo");
        continue;
      }

      logger.warn({ provider, err: String(err) }, "Fallback: motor falhou, tentando próximo");
    }
  }

  throw new Error(`Todos os motores falharam. Último erro: ${String(lastError)}`);
}
