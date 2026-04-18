import type { AIProvider } from "./providerConfig.js";
import { queryGemini, GEMINI_MODEL_V2, GEMINI_MODEL_V3 } from "./gemini.js";
import { queryOpenAI } from "./openai.js";
import { queryDeepSeek } from "./deepseek.js";
import { logger } from "../utils/logger.js";

const CLOUD_CHAIN: AIProvider[] = ["gemini-v3", "gemini", "openai-v4", "deepseek-v5"];

function isAvailable(provider: AIProvider): boolean {
  if (provider === "gemini" || provider === "gemini-v3") {
    return !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim() && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim());
  }
  if (provider === "openai-v4") {
    return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim() && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim());
  }
  if (provider === "deepseek-v5") {
    return !!(process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY?.trim() && process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL?.trim());
  }
  return false;
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
    if (!isAvailable(provider)) {
      logger.warn({ provider }, "Fallback: provider sem credenciais, pulando");
      continue;
    }
    try {
      const result = await queryWithProvider(provider, systemPrompt, memoryKey, userQuery);
      if (provider !== primaryProvider) {
        logger.warn({ primaryProvider, usedProvider: provider }, "Fallback automático ativado");
      }
      return result;
    } catch (err) {
      lastError = err;
      logger.warn({ provider, err: String(err) }, "Fallback: provider falhou, tentando próximo");
    }
  }

  throw new Error(`Todos os motores falharam. Último erro: ${String(lastError)}`);
}
