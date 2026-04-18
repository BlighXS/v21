type Status = "online" | "offline" | "loading";
type SysStatus = { bot: Status; gemini: Status; openai: Status; deepseek: Status; api: Status; };

interface Props {
  status: SysStatus;
}

function StatusRow({ label, value, status, sub }: { label: string; value: string; status: Status; sub?: string }) {
  const dotClass = status === "online" ? "dot-online" : status === "loading" ? "dot-loading" : "dot-offline";
  const statusLabel = status === "online" ? "ONLINE" : status === "loading" ? "INIT" : "OFFLINE";
  const statusColor = status === "online" ? "var(--green)" : status === "loading" ? "var(--orange)" : "var(--red)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-dim)",
        gap: 10,
      }}
    >
      <div
        className={`dot-${status === "online" ? "online" : status === "loading" ? "loading" : "offline"}`}
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          flexShrink: 0,
          background: statusColor,
          boxShadow: status === "online" ? `0 0 8px ${statusColor}` : "none",
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-bright)" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--text-dim)", marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", fontWeight: 700, color: statusColor, letterSpacing: "0.08em" }}>
          {statusLabel}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--text-dim)", marginTop: 1 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function StatusGrid({ status }: Props) {
  return (
    <div id="status" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* System Status */}
      <div className="tile" style={{ gridColumn: "1", gridRow: "1" }}>
        <div className="tile-header">
          <div className="tile-header-dot" />
          <span className="tile-header-label">SYS_STATUS</span>
          <span className="tile-id">#001</span>
        </div>
        <StatusRow label="FAWER_BOT" value="discord.gg" status={status.bot} sub="Fawer's#7769" />
        <StatusRow label="API_SERVER" value="port :8080" status={status.api} sub="express v5" />
        <div style={{ padding: "10px 14px" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--text-dim)" }}>
            <div style={{ marginBottom: 6, color: "var(--text-bright)", fontSize: "0.65rem", fontWeight: 600 }}>HARDWARE</div>
            {[
              ["GPU", "NVIDIA RTX A6000 · 48GB VRAM"],
              ["VRAM", "48,000 MB ECC"],
              ["DRIVER", "535.183.06"],
              ["CUDA", "12.2"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span>{k}</span>
                <span style={{ color: "var(--cyan)", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Engines */}
      <div className="tile" style={{ gridColumn: "2", gridRow: "1" }}>
        <div className="tile-header">
          <div className="tile-header-dot" style={{ background: "var(--cyan)", boxShadow: "0 0 6px var(--cyan)" }} />
          <span className="tile-header-label" style={{ color: "var(--cyan-dim)" }}>AI_ENGINES</span>
          <span className="tile-id">#002</span>
        </div>
        <StatusRow label="FAWER_V2" value="gemini-2.5-flash" status={status.gemini} sub="Google DeepMind" />
        <StatusRow label="FAWER_V3" value="gemini-3-flash-preview" status={status.gemini} sub="next-gen reasoning" />
        <StatusRow label="FAWER_V4" value="gpt-5.2" status={status.openai} sub="OpenAI · via Replit" />
        <StatusRow label="FAWER_V5" value="deepseek-chat" status={status.deepseek} sub="OpenRouter · DeepSeek" />
      </div>
    </div>
  );
}
