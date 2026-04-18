import Header from "./components/Header";
import StatusGrid from "./components/StatusGrid";
import AIModules from "./components/AIModules";
import BotPanel from "./components/BotPanel";
import AccessPanel from "./components/AccessPanel";
import TerminalLog from "./components/TerminalLog";
import HubDM from "./components/HubDM";
import { useSysStatus } from "./hooks/useSysStatus";
import { useMe } from "./hooks/useMe";

export default function App() {
  const status = useSysStatus();
  const { me } = useMe();

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <Header apiOnline={status.api === "online"} />

      {/* Grid background pattern */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(var(--border-dim) 1px, transparent 1px), linear-gradient(90deg, var(--border-dim) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <main
        style={{
          flex: 1,
          position: "relative",
          zIndex: 1,
          padding: "24px 20px 40px",
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Hero */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            paddingBottom: 16,
            borderBottom: "1px solid var(--border-dim)",
            animation: "fadeInUp 0.5s ease both",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "2rem",
                fontWeight: 700,
                color: "var(--text-bright)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginBottom: 8,
              }}
            >
              FAW<span style={{ color: "var(--green)" }}>_</span>HUB
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "0.68rem",
                color: "var(--text-dim)",
                letterSpacing: "0.08em",
              }}
            >
              FAWER SYSTEMS · CENTRAL DE CONTROLE · {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {[
              { label: "BOT", s: status.bot },
              { label: "API", s: status.api },
              { label: "AI", s: status.gemini === "online" || status.openai === "online" ? "online" as const : status.ollama },
            ].map(({ label, s }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--mono)",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "6px 12px",
                  border: "1px solid var(--border-dim)",
                  borderRadius: "2px",
                  background: "var(--bg2)",
                  letterSpacing: "0.08em",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: s === "online" ? "var(--green)" : s === "loading" ? "var(--orange)" : "var(--red)",
                    boxShadow: s === "online" ? "0 0 8px var(--green)" : "none",
                    animation: s === "loading" ? "blink 1s step-end infinite" : "none",
                  }}
                />
                <span style={{ color: s === "online" ? "var(--text-bright)" : "var(--text-dim)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Boot log */}
        <div style={{ animation: "fadeInUp 0.5s ease 0.1s both" }}>
          <TerminalLog />
        </div>

        {/* Status */}
        <div style={{ animation: "fadeInUp 0.5s ease 0.2s both" }}>
          <StatusGrid status={status} />
        </div>

        {/* AI Modules */}
        <div style={{ animation: "fadeInUp 0.5s ease 0.3s both" }}>
          <AIModules />
        </div>

        {/* Bot Panel */}
        <div style={{ animation: "fadeInUp 0.5s ease 0.4s both" }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)" }}>
              BOT_INTERFACE
            </span>
          </div>
          <BotPanel />
        </div>

        {/* Access */}
        <div style={{ animation: "fadeInUp 0.5s ease 0.5s both" }}>
          <AccessPanel />
        </div>

        {/* Hub DM — only visible to owner */}
        {me?.isOwner && (
          <div style={{ animation: "fadeInUp 0.5s ease 0.6s both" }}>
            <HubDM />
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 8,
            paddingTop: 16,
            borderTop: "1px solid var(--border-dim)",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--mono)",
            fontSize: "0.6rem",
            color: "var(--text-dim)",
            letterSpacing: "0.06em",
          }}
        >
          <span>FAW_HUB · FAWER SYSTEMS · {new Date().getFullYear()}</span>
          <span>RTX A6000 · 48GB VRAM · CUDA 12.2</span>
          <span>
            STATUS:{" "}
            <span style={{ color: status.api === "online" ? "var(--green)" : "var(--red)" }}>
              {status.api === "online" ? "OPERATIONAL" : "DEGRADED"}
            </span>
          </span>
        </div>
      </main>
    </div>
  );
}
