import OpenAI, { toFile } from "openai";
import { GoogleGenAI } from "@google/genai";
import { getProvider } from "./providerConfig.js";
import { logger } from "../utils/logger.js";

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  ext: string;
}

async function downloadImageBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const mimeType = res.headers.get("content-type") || "image/png";
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

async function generateWithOpenAI(prompt: string, sourceBuffer?: Buffer, sourceMime?: string): Promise<GeneratedImage> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  if (!apiKey || !baseURL) throw new Error("Integração OpenAI não configurada.");

  const client = new OpenAI({ apiKey, baseURL });

  let b64: string | null | undefined;

  if (sourceBuffer) {
    const ext = (sourceMime ?? "image/png").split("/")[1] ?? "png";
    const imageFile = await toFile(sourceBuffer, `source.${ext}`, { type: sourceMime ?? "image/png" });
    const response = await client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      n: 1,
      size: "1024x1024"
    });
    b64 = response.data?.[0]?.b64_json;
  } else {
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1024x1024"
    });
    b64 = response.data?.[0]?.b64_json;
  }

  if (!b64) throw new Error("Nenhuma imagem retornada pelo OpenAI.");
  return { buffer: Buffer.from(b64, "base64"), mimeType: "image/png", ext: "png" };
}

async function generateWithGemini(prompt: string, sourceBuffer?: Buffer, sourceMime?: string): Promise<GeneratedImage> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  const baseURL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();
  if (!apiKey || !baseURL) throw new Error("Integração Gemini não configurada.");

  const ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: baseURL, apiVersion: "" } });

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (sourceBuffer) {
    parts.push({ inlineData: { mimeType: sourceMime ?? "image/png", data: sourceBuffer.toString("base64") } });
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["TEXT", "IMAGE"] }
  });

  const resParts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of resParts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || "image/png";
      const ext = mimeType.split("/")[1] ?? "png";
      return { buffer: Buffer.from(part.inlineData.data, "base64"), mimeType, ext };
    }
  }

  throw new Error("Nenhuma imagem retornada pelo Gemini.");
}

export async function generateImage(prompt: string, sourceImageUrl?: string): Promise<GeneratedImage> {
  const provider = await getProvider();

  let sourceBuffer: Buffer | undefined;
  let sourceMime: string | undefined;

  if (sourceImageUrl) {
    try {
      const dl = await downloadImageBuffer(sourceImageUrl);
      sourceBuffer = dl.buffer;
      sourceMime = dl.mimeType;
      logger.info({ sourceImageUrl }, "Imagem fonte baixada para edição");
    } catch (err) {
      logger.warn({ err: String(err) }, "Falha ao baixar imagem fonte — gerando nova imagem");
    }
  }

  if (provider === "openai-v4") {
    logger.info({ provider, prompt: prompt.slice(0, 80), editing: !!sourceBuffer }, "Gerando imagem via OpenAI");
    return generateWithOpenAI(prompt, sourceBuffer, sourceMime);
  }

  if (provider === "gemini" || provider === "gemini-v3") {
    logger.info({ provider, prompt: prompt.slice(0, 80), editing: !!sourceBuffer }, "Gerando imagem via Gemini");
    return generateWithGemini(prompt, sourceBuffer, sourceMime);
  }

  // Beta (Ollama) não suporta imagem — tenta OpenAI ou Gemini
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    logger.info({ provider }, "Beta ativo, gerando imagem via OpenAI como fallback");
    return generateWithOpenAI(prompt, sourceBuffer, sourceMime);
  }

  if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
    logger.info({ provider }, "Beta ativo, gerando imagem via Gemini como fallback");
    return generateWithGemini(prompt, sourceBuffer, sourceMime);
  }

  throw new Error("Geração de imagem não disponível no modelo Beta. Use V2, V3 ou V4.");
}
