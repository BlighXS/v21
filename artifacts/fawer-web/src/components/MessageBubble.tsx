import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import type { Message } from "../hooks/useChat";

interface Props {
  message: Message;
}

function formatContent(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MODEL_NAMES: Record<string, string> = {
  ollama: "Beta",
  gemini: "V2",
  "gemini-v3": "V3",
  "openai-v4": "V4",
};

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex justify-end px-4 py-1.5"
      >
        <div
          className="max-w-[72%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
          style={{
            background: "var(--accent)",
            color: "white",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 px-4 py-1.5"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="flex items-center justify-center rounded-xl"
          style={{
            width: 28,
            height: 28,
            background: message.error
              ? "rgba(248,113,113,0.1)"
              : "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
            border: message.error ? "1px solid rgba(248,113,113,0.3)" : "none",
          }}
        >
          {message.error ? (
            <AlertCircle size={14} style={{ color: "#f87171" }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 36 36" fill="none">
              <path d="M18 4L32 28H4L18 4Z" fill="white" opacity="0.9" />
              <circle cx="18" cy="20" r="3" fill="white" opacity="0.6" />
            </svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            FAWER AI
          </span>
          {message.provider && (
            <span
              className="text-xs rounded px-1.5 py-0.5"
              style={{
                background: "var(--bg-border)",
                color: "var(--text-muted)",
                fontSize: "0.65rem",
                fontWeight: 600,
              }}
            >
              {MODEL_NAMES[message.provider] ?? message.provider}
            </span>
          )}
          {message.error && (
            <span className="text-xs" style={{ color: "#f87171" }}>
              Erro
            </span>
          )}
        </div>

        <div
          className="text-sm leading-relaxed"
          style={{
            color: message.error ? "#f87171" : "var(--text-primary)",
            wordBreak: "break-word",
          }}
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />

        <div className="mt-1.5 text-xs" style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
          {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </motion.div>
  );
}
