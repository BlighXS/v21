const COMMANDS = [
  { cmd: ";ask [msg]", desc: "Conversa com FAWER AI no Discord" },
  { cmd: ";fwp [msg]", desc: "Modo autônomo — IA age livremente" },
  { cmd: ";setup", desc: "Painel de configuração (admin)" },
  { cmd: ";ban @user", desc: "Banir membro do servidor" },
  { cmd: ";kick @user", desc: "Expulsar membro" },
  { cmd: ";mute @user", desc: "Silenciar por timeout" },
  { cmd: ";free #canal", desc: "Ativar modo livre no canal" },
];

const ACTIONS = [
  "create_channel · delete_channel",
  "ban_member · kick_member · mute_member",
  "send_message · manage_roles",
  "generate_image · edit_image",
  "web_search · code_exec",
  "memory_store · context_load",
];

export default function BotPanel() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* Commands */}
      <div className="tile">
        <div className="tile-header">
          <div className="tile-header-dot" style={{ background: "var(--orange)", boxShadow: "0 0 6px var(--orange)" }} />
          <span className="tile-header-label" style={{ color: "rgba(255,107,53,0.6)" }}>BOT_COMMANDS</span>
          <span className="tile-id">#003</span>
        </div>
        <div style={{ padding: "8px 0" }}>
          {COMMANDS.map((c) => (
            <div
              key={c.cmd}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "7px 14px",
                borderBottom: "1px solid var(--border-dim)",
                transition: "background 0.2s",
                cursor: "default",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,107,53,0.04)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
            >
              <code
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--orange)",
                  flexShrink: 0,
                  minWidth: 120,
                }}
              >
                {c.cmd}
              </code>
              <span style={{ fontFamily: "var(--sans)", fontSize: "0.7rem", color: "var(--text-dim)" }}>
                {c.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Autonomous Actions */}
      <div className="tile">
        <div className="tile-header">
          <div className="tile-header-dot" style={{ background: "#a78bfa", boxShadow: "0 0 6px #a78bfa" }} />
          <span className="tile-header-label" style={{ color: "rgba(167,139,250,0.7)" }}>FWP_ACTIONS</span>
          <span className="tile-id">#004</span>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontFamily: "var(--sans)", fontSize: "0.72rem", color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 14 }}>
            No modo <span style={{ color: "#a78bfa", fontFamily: "var(--mono)", fontWeight: 600 }}>;fwp</span>, a IA age autonomamente no servidor. Ela pode executar as seguintes ações sem confirmação:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ACTIONS.map((a) => (
              <div
                key={a}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "0.65rem",
                  color: "var(--text-dim)",
                  padding: "6px 10px",
                  background: "rgba(167,139,250,0.04)",
                  borderLeft: "2px solid rgba(167,139,250,0.2)",
                  borderRadius: "0 2px 2px 0",
                }}
              >
                {a}
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "rgba(255,59,92,0.6)", marginTop: 12 }}>
            [!] uso livre — sem confirmação manual
          </p>
        </div>
      </div>
    </div>
  );
}
