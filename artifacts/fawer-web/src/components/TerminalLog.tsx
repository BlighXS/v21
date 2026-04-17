import { useEffect, useState, useRef } from "react";

const BOOT_LINES = [
  { t: 0,   color: "var(--text-dim)", text: "FAW_HUB bootloader v2.4 — inicializando..." },
  { t: 280, color: "var(--green)",    text: "[OK] kernel carregado" },
  { t: 520, color: "var(--green)",    text: "[OK] conexão API estabelecida :8080" },
  { t: 760, color: "var(--cyan)",     text: "[OK] motores AI mapeados — 4 módulos" },
  { t: 980, color: "var(--green)",    text: "[OK] Fawer's#7769 online — 1 guild" },
  { t: 1180, color: "var(--text-dim)", text: "sistema pronto. sessão iniciada." },
];

export default function TerminalLog() {
  const [lines, setLines] = useState<typeof BOOT_LINES>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((line) => {
      timers.push(setTimeout(() => setLines((prev) => [...prev, line]), line.t + 100));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="tile"
      style={{ padding: "10px 14px" }}
    >
      <div className="tile-header" style={{ margin: "-10px -14px 10px", padding: "8px 14px" }}>
        <div className="tile-header-dot" />
        <span className="tile-header-label">BOOT_LOG</span>
        <span className="tile-id">#000</span>
      </div>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.68rem",
            color: line.color,
            lineHeight: 1.8,
            opacity: 0,
            animation: "fadeInUp 0.3s ease forwards",
            animationDelay: `${i * 0.05}s`,
          }}
        >
          <span style={{ color: "var(--text-dim)", marginRight: 8, userSelect: "none" }}>›</span>
          {line.text}
          {i === lines.length - 1 && lines.length === BOOT_LINES.length && (
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: "0.75em",
                background: "var(--green)",
                marginLeft: 3,
                verticalAlign: "middle",
                animation: "cursor 1s step-end infinite",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
