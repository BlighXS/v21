interface AccessLink {
  id: string;
  label: string;
  desc: string;
  href: string;
  color: string;
  tag: string;
}

const LINKS: AccessLink[] = [
  {
    id: "ACCESS-001",
    label: "discord.gg/fawer",
    desc: "Servidor Discord principal — acesso completo ao bot",
    href: "https://discord.gg",
    color: "#5865F2",
    tag: "DISCORD_SERVER",
  },
  {
    id: "ACCESS-002",
    label: "convidar o bot",
    desc: "Adicione Fawer's Bot ao seu servidor com permissões completas",
    href: `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(import.meta.env.VITE_DISCORD_CLIENT_ID || "")}&permissions=8&scope=bot`,
    color: "#7289da",
    tag: "BOT_INVITE",
  },
  {
    id: "ACCESS-003",
    label: "FAWER AI Chat",
    desc: "Interface web para conversar com todos os modelos disponíveis",
    href: "/chat",
    color: "var(--green)",
    tag: "WEB_CHAT",
  },
];

export default function AccessPanel() {
  return (
    <div id="access">
      <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-dim)" }}>
          ACCESS_POINTS
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {LINKS.map((link) => (
          <a
            key={link.id}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="tile"
            style={{
              textDecoration: "none",
              display: "block",
              cursor: "pointer",
              transition: "all 0.25s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = `${link.color}40`;
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 0 24px ${link.color}10`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-dim)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
            }}
          >
            <div className="tile-header">
              <div
                className="tile-header-dot"
                style={{ background: link.color, boxShadow: `0 0 6px ${link.color}` }}
              />
              <span className="tile-header-label" style={{ color: link.color, opacity: 0.7 }}>
                {link.tag}
              </span>
              <span className="tile-id">{link.id}</span>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: link.color,
                  marginBottom: 6,
                }}
              >
                {link.label}
              </div>
              <div style={{ fontFamily: "var(--sans)", fontSize: "0.7rem", color: "var(--text-dim)", lineHeight: 1.5 }}>
                {link.desc}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: "var(--mono)",
                  fontSize: "0.6rem",
                  color: link.color,
                  opacity: 0.6,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                → acessar
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
