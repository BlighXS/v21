import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { getProvider } from "./providerConfig.js";
import { logger } from "../utils/logger.js";

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  ext: string;
}

async function generateWithOpenAI(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  if (!apiKey || !baseURL) throw new Error("Integração OpenAI não configurada.");

  const client = new OpenAI({ apiKey, baseURL });
  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size: "1024x1024"
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("Nenhuma imagem retornada pelo OpenAI.");

  return {
    buffer: Buffer.from(b64, "base64"),
    mimeType: "image/png",
    ext: "png"
  };
}

async function generateWithGemini(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  const baseURL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();
  if (!apiKey || !baseURL) throw new Error("Integração Gemini não configurada.");

  const ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: baseURL, apiVersion: "" } });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseModalities: ["TEXT", "IMAGE"] }
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || "image/png";
      const ext = mimeType.split("/")[1] ?? "png";
      return {
        buffer: Buffer.from(part.inlineData.data, "base64"),
        mimeType,
        ext
      };
    }
  }

  throw new Error("Nenhuma imagem retornada pelo Gemini.");
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const provider = await getProvider();

  if (provider === "openai-v4") {
    logger.info({ provider, prompt: prompt.slice(0, 80) }, "Gerando imagem via OpenAI");
    return generateWithOpenAI(prompt);
  }

  if (provider === "gemini" || provider === "gemini-v3") {
    logger.info({ provider, prompt: prompt.slice(0, 80) }, "Gerando imagem via Gemini");
    return generateWithGemini(prompt);
  }

  // Beta (ollama) não suporta geração de imagem — tenta OpenAI como fallback
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    logger.info({ provider, prompt: prompt.slice(0, 80) }, "Beta ativo, gerando imagem via OpenAI como fallback");
    return generateWithOpenAI(prompt);
  }

  if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
    logger.info({ provider, prompt: prompt.slice(0, 80) }, "Beta ativo, gerando imagem via Gemini como fallback");
    return generateWithGemini(prompt);
  }

  throw new Error("Geração de imagem não disponível no modelo Beta. Use V2, V3 ou V4.");
}
