import type { AIProvider } from "./providerConfig.js";
import { queryGemini, GEMINI_MODEL_V2, GEMINI_MODEL_V3 } from "./gemini.js";
import { queryOpenAI } from "./openai.js";
import { queryDeepSeek } from "./deepseek.js";
import { logger } from "../utils/logger.js";

const CLOUD_CHAIN: AIProvider[] = ["deepseek-v5", "gemini-v3", "gemini", "openai-v4"];

function isContextError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return msg.includes("maximum context length") || msg.includes("context length") || msg.includes("requested about");
}

async function queryWithProvider(
  provider: AIProvider,
  systemPrompt: string,
  memoryKey: string,
  userQuery: string
): Promise<string> {
  if (provider === "gemini-v3") {
    return queryGemini(systemPrompt, memoryKey, userQuery, GEMINI_MODEL_V3);
  }
  if (provider === "gemini") {
    return queryGemini(systemPrompt, memoryKey, userQuery, GEMINI_MODEL_V2);
  }
  if (provider === "openai-v4") {
    return queryOpenAI(systemPrompt, memoryKey, userQuery);
  }
  if (provider === "deepseek-v5") {
    return queryDeepSeek(systemPrompt, memoryKey, userQuery);
  }
  throw new Error(`Provider não suportado no fallback: ${provider}`);
}

export async function queryWithFallback(
  primaryProvider: AIProvider,
  systemPrompt: string,
  memoryKey: string,
  userQuery: string
): Promise<string> {
  const chain: AIProvider[] = [
    primaryProvider,
    ...CLOUD_CHAIN.filter((p) => p !== primaryProvider)
  ].filter((p) => p !== "ollama");

  let lastError: unknown;

  for (const provider of chain) {
    try {
      const result = await queryWithProvider(provider, systemPrompt, memoryKey, userQuery);
      if (provider !== primaryProvider) {
        logger.warn({ primaryProvider, usedProvider: provider }, "Modelo trocado automaticamente");
      }
      return result;
    } catch (err) {
      lastError = err;
      if (provider === "deepseek-v5" && isContextError(err)) {
        logger.warn({ provider, err: String(err) }, "Contexto muito grande no V5, pulando para o próximo");
        continue;
      }
      logger.warn({ provider, err: String(err) }, "Fallback: provider falhou, tentando próximo");
    }
  }

  throw new Error(`Todos os motores falharam. Último erro: ${String(lastError)}`);
}
