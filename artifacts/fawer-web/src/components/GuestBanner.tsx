import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useState } from "react";

interface Props {
  messagesLeft: number;
  onLogin: () => void;
}

export default function GuestBanner({ messagesLeft, onLogin }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isLow = messagesLeft <= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 px-4 py-2.5 text-xs flex-shrink-0"
      style={{
        background: isLow
          ? "rgba(243,139,168,0.08)"
          : "rgba(124,110,230,0.06)",
        borderBottom: `1px solid ${isLow ? "rgba(243,139,168,0.2)" : "var(--bg-elevated)"}`,
      }}
    >
      <div className="flex-1 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
        <span>Modo convidado</span>
        <span style={{ color: isLow ? "var(--danger)" : "var(--accent)", fontWeight: 600 }}>
          {messagesLeft} mensagem{messagesLeft !== 1 ? "s" : ""} restante{messagesLeft !== 1 ? "s" : ""}
        </span>
      </div>
      <button
        onClick={onLogin}
        className="text-xs rounded-lg px-3 py-1.5 font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
        style={{ background: "#5865F2", color: "white" }}
      >
        Entrar com Discord
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:opacity-60 transition-opacity"
        style={{ color: "var(--text-muted)" }}
      >
        <X size={12} />
      </button>
    </motion.div>
  );
}
