import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    models: [
      {
        id: "ollama",
        name: "FAWER Beta",
        description: "Modelo local CPU — privado e rápido para tarefas simples",
        icon: "🧠",
        badge: "Beta",
        available: true,
      },
      {
        id: "gemini",
        name: "FAWER V2",
        description: "Gemini 2.5 Flash — inteligência avançada do Google",
        icon: "✨",
        badge: "V2",
        available: !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      },
      {
        id: "gemini-v3",
        name: "FAWER V3",
        description: "Gemini 3 Flash — raciocínio de próxima geração",
        icon: "🔮",
        badge: "V3",
        available: !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      },
      {
        id: "openai-v4",
        name: "FAWER V4",
        description: "GPT-5.2 — o modelo mais poderoso disponível",
        icon: "⚡",
        badge: "V4",
        available: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      },
    ],
  });
});

export default router;
