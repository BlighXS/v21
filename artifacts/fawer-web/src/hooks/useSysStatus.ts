import { useState, useEffect } from "react";

interface SysStatus {
  bot: "online" | "offline" | "loading";
  ollama: "online" | "offline" | "loading";
  gemini: "online" | "offline" | "loading";
  openai: "online" | "offline" | "loading";
  deepseek: "online" | "offline" | "loading";
  api: "online" | "offline" | "loading";
}

export function useSysStatus() {
  const [status, setStatus] = useState<SysStatus>({
    bot: "loading",
    ollama: "loading",
    gemini: "loading",
    openai: "loading",
    deepseek: "loading",
    api: "loading",
  });

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/models", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          models: Array<{ id: string; available: boolean }>;
        };
        const find = (id: string): "online" | "offline" =>
          data.models.find((m) => m.id === id)?.available ? "online" : "offline";

        setStatus({
          bot: "online",
          api: "online",
          ollama: find("ollama"),
          gemini: find("gemini-v3"),
          openai: find("openai-v4"),
          deepseek: find("deepseek-v5"),
        });
      } catch {
        setStatus((s) => ({ ...s, api: "offline", bot: "offline" }));
      }
    }

    void check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  return status;
}
