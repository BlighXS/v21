import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  const geminiReady = !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL);
  const openaiReady = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
  const openrouterReady = !!(process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY && process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL);

  res.json({
    models: [
      {
        id: "gemini",
        name: "FAWER V2",
        description: "Gemini 2.5 Flash — inteligência avançada do Google",
        icon: "✨",
        badge: "V2",
        available: geminiReady,
      },
      {
        id: "gemini-v3",
        name: "FAWER V3",
        description: "Gemini 3 Flash — raciocínio de próxima geração",
        icon: "🔮",
        badge: "V3",
        available: geminiReady,
      },
      {
        id: "openai-v4",
        name: "FAWER V4",
        description: "GPT-5.2 — o modelo mais poderoso disponível",
        icon: "⚡",
        badge: "V4",
        available: openaiReady,
      },
      {
        id: "deepseek-v5",
        name: "FAWER V5",
        description: "DeepSeek via OpenRouter — raciocínio profundo e eficiente",
        icon: "🌊",
        badge: "V5",
        available: openrouterReady,
      },
    ],
  });
});

export default router;
