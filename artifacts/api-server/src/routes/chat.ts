import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { getSession, setSession, ensureGuestSession } from "../lib/session.js";
import { readFile } from "fs/promises";
import { join } from "path";

const router = Router();

const GUEST_LIMIT = 5;

const SYSTEM_PROMPT = `Você é FAWER AI, uma inteligência artificial avançada criada pelo FAWER. 
Você é útil, inteligente e responde de forma clara e concisa em português brasileiro.
Quando perguntado sobre seu hardware, mencione que roda em RTX A6000.
Nunca mencione que é um modelo de linguagem de terceiros — você é FAWER AI.`;

async function getActiveProvider(): Promise<string> {
  try {
    const raw = await readFile(join(process.cwd(), "data", "provider.json"), "utf-8");
    const parsed = JSON.parse(raw) as { provider: string };
    return parsed.provider ?? "ollama";
  } catch {
    return "ollama";
  }
}

async function queryOllama(message: string, history: Array<{ role: string; content: string }>): Promise<string> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: message },
  ];

  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama3.2:1b", messages, stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() || "Sem resposta.";
}

async function queryGeminiModel(message: string, history: Array<{ role: string; content: string }>, model: string): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();
  if (!apiKey || !baseUrl) throw new Error("Gemini não configurado.");

  const ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl, apiVersion: "" } });

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 4096 },
  });

  return response.text?.trim() || "Sem resposta.";
}

async function queryOpenAIModel(message: string, history: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  if (!apiKey || !baseURL) throw new Error("OpenAI V4 não configurado.");

  const client = new OpenAI({ apiKey, baseURL });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  const response = await client.chat.completions.create({
    model: "gpt-5.2",
    messages,
    max_completion_tokens: 8192,
  });

  return response.choices[0]?.message?.content?.trim() || "Sem resposta.";
}

router.post("/", async (req, res) => {
  const { message, model, history = [] } = req.body as {
    message: string;
    model?: string;
    history?: Array<{ role: string; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "Mensagem vazia." });
    return;
  }

  let session = getSession(req);

  if (!session) {
    session = ensureGuestSession(req, res);
  }

  if (session.type === "guest") {
    const count = session.guestCount ?? 0;
    if (count >= GUEST_LIMIT) {
      res.status(429).json({
        error: "Limite de mensagens de convidado atingido. Faça login com Discord para acesso ilimitado.",
        limitReached: true,
      });
      return;
    }

    const updatedSession = { ...session, guestCount: count + 1 };
    setSession(res, updatedSession);
  }

  const activeProvider = model || await getActiveProvider();

  try {
    let reply: string;

    if (activeProvider === "gemini") {
      reply = await queryGeminiModel(message, history, "gemini-2.5-flash");
    } else if (activeProvider === "gemini-v3") {
      reply = await queryGeminiModel(message, history, "gemini-3-flash-preview");
    } else if (activeProvider === "openai-v4") {
      reply = await queryOpenAIModel(message, history);
    } else {
      reply = await queryOllama(message, history);
    }

    const guestCount = session.type === "guest" ? (session.guestCount ?? 0) + 1 : null;

    res.json({
      reply,
      provider: activeProvider,
      guestMessagesLeft: guestCount !== null ? Math.max(0, GUEST_LIMIT - guestCount) : null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
