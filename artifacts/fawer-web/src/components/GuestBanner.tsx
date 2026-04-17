import { motion } from "framer-motion";

interface Props {
  messagesLeft: number;
  onLogin: () => void;
}

export default function GuestBanner({ messagesLeft, onLogin }: Props) {
  const pct = (messagesLeft / 5) * 100;
  const color = messagesLeft <= 1 ? "#f87171" : messagesLeft <= 2 ? "#fbbf24" : "var(--accent)";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 text-xs"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--bg-border)" }}
    >
      <div className="flex-1 flex items-center gap-2">
        <span style={{ color: "var(--text-muted)" }}>Modo convidado</span>
        <div
          className="flex-1 rounded-full overflow-hidden"
          style={{ height: 3, background: "var(--bg-border)", maxWidth: 80 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span style={{ color, fontWeight: 500 }}>
          {messagesLeft} msg restante{messagesLeft !== 1 ? "s" : ""}
        </span>
      </div>
      <button
        onClick={onLogin}
        className="text-xs rounded-lg px-3 py-1.5 font-medium transition-opacity hover:opacity-80"
        style={{ background: "#5865F2", color: "white" }}
      >
        Fazer login
      </button>
    </motion.div>
  );
}
