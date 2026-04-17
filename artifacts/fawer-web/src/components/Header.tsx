import { useUptime } from "../hooks/useUptime";

interface Props {
  apiOnline: boolean;
}

export default function Header({ apiOnline }: Props) {
  const uptime = useUptime();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(12,12,15,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-dim)",
        padding: "0 20px",
        height: 48,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: apiOnline ? "var(--green)" : "var(--red)",
            boxShadow: apiOnline ? "0 0 8px var(--green)" : "none",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--text-bright)",
            letterSpacing: "0.05em",
          }}
        >
          FAW_HUB
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.6rem",
            color: "var(--text-dim)",
            letterSpacing: "0.08em",
          }}
        >
          v2.4
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Uptime */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--mono)",
          fontSize: "0.65rem",
          color: "var(--text-dim)",
        }}
      >
        <span>SESSION</span>
        <span style={{ color: "var(--green)", fontWeight: 600 }}>{uptime}</span>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", gap: 4 }}>
        {[
          { label: "STATUS", href: "#status" },
          { label: "MÓDULOS", href: "#modules" },
          { label: "ACESSO", href: "#access" },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            style={{
              fontFamily: "var(--mono)",
              fontSize: "0.62rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "var(--text-dim)",
              textDecoration: "none",
              padding: "4px 10px",
              border: "1px solid transparent",
              borderRadius: "2px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--green)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLAnchorElement).style.background = "var(--green-glow)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-dim)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
