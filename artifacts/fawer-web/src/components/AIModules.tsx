interface Module {
  id: string;
  name: string;
  model: string;
  provider: string;
  context: string;
  capabilities: string[];
  badge: string;
  color: string;
}

const MODULES: Module[] = [
  {
    id: "FAW-BETA-001",
    name: "FAWER Beta",
    model: "llama3.2:1b",
    provider: "Ollama · Local",
    context: "128K tokens",
    badge: "BETA",
    color: "var(--text-dim)",
    capabilities: ["Respostas rápidas", "Privado · sem cloud", "CPU inference", "Sempre disponível"],
  },
  {
    id: "FAW-V2-001",
    name: "FAWER V2",
    model: "gemini-2.5-flash",
    provider: "Google DeepMind",
    context: "1M tokens",
    badge: "V2",
    color: "var(--cyan)",
    capabilities: ["Análise de imagem", "Código avançado", "Multilíngue", "Raciocínio longo"],
  },
  {
    id: "FAW-V3-001",
    name: "FAWER V3",
    model: "gemini-3-flash-preview",
    provider: "Google DeepMind",
    context: "1M tokens",
    badge: "V3",
    color: "#a78bfa",
    capabilities: ["Próxima geração", "Raciocínio avançado", "Edição de imagem", "Preview exclusivo"],
  },
  {
    id: "FAW-V4-001",
    name: "FAWER V4",
    model: "gpt-5.2",
    provider: "OpenAI",
    context: "128K tokens",
    badge: "V4",
    color: "var(--green)",
    capabilities: ["GPT-5.2 flagship", "Geração de imagem", "Código profissional", "Topo de linha"],
  },
];

export default function AIModules() {
  return (
    <div id="modules">
      <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)" }}>
          AI_MODULES
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--text-dim)" }}>
          — 4 motores carregados
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {MODULES.map((mod) => (
          <div
            key={mod.id}
            className="tile"
            style={{ "--accent-color": mod.color } as React.CSSProperties}
          >
            <div className="tile-header">
              <div
                className="tile-header-dot"
                style={{ background: mod.color, boxShadow: `0 0 6px ${mod.color}` }}
              />
              <span className="tile-header-label" style={{ color: mod.color, opacity: 0.7 }}>
                {mod.badge}
              </span>
              <span className="tile-id">{mod.id}</span>
            </div>

            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontFamily: "var(--sans)", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-bright)", marginBottom: 4 }}>
                {mod.name}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: mod.color, marginBottom: 10 }}>
                {mod.model}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 8px", marginBottom: 12, fontFamily: "var(--mono)", fontSize: "0.6rem" }}>
                {[
                  ["PROVIDER", mod.provider],
                  ["CONTEXT", mod.context],
                ].map(([k, v]) => (
                  <span key={k} style={{ display: "contents" }}>
                    <span style={{ color: "var(--text-dim)" }}>{k}</span>
                    <span style={{ color: "var(--text)" }}>{v}</span>
                  </span>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--border-dim)", paddingTop: 10 }}>
                {mod.capabilities.map((cap) => (
                  <div
                    key={cap}
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "0.62rem",
                      color: "var(--text-dim)",
                      marginBottom: 4,
                      paddingLeft: 8,
                      borderLeft: `2px solid ${mod.color}30`,
                    }}
                  >
                    {cap}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
