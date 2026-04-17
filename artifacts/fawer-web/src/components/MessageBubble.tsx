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
        transition={{ duration: 0.25 }}
        className="flex justify-end px-6 py-1.5"
      >
        <div
          className="max-w-[72%] rounded-2xl rounded-tr-md px-4 py-3 text-sm"
          style={{
            background: "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
            color: "white",
            wordBreak: "break-word",
            lineHeight: 1.65,
            boxShadow: "0 2px 16px rgba(124,110,230,0.2)",
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
      transition={{ duration: 0.25 }}
      className="flex gap-3 px-6 py-2"
    >
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="flex items-center justify-center rounded-xl"
          style={{
            width: 30,
            height: 30,
            background: message.error
              ? "rgba(243,139,168,0.1)"
              : "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
            border: message.error ? "1px solid rgba(243,139,168,0.3)" : "none",
            boxShadow: message.error ? "none" : "0 2px 8px rgba(124,110,230,0.2)",
          }}
        >
          {message.error ? (
            <AlertCircle size={14} style={{ color: "var(--danger)" }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 36 36" fill="none">
              <path d="M18 4L32 28H4L18 4Z" fill="white" opacity="0.9" />
              <circle cx="18" cy="20" r="3" fill="white" opacity="0.6" />
            </svg>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            FAWER AI
          </span>
          {message.provider && (
            <span
              className="text-xs rounded-md px-1.5 py-0.5"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--accent)",
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                border: "1px solid rgba(124,110,230,0.2)",
              }}
            >
              {MODEL_NAMES[message.provider] ?? message.provider}
            </span>
          )}
          {message.error && (
            <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
              Erro
            </span>
          )}
        </div>

        <div
          className="text-sm"
          style={{
            color: message.error ? "var(--danger)" : "var(--text-primary)",
            wordBreak: "break-word",
            lineHeight: 1.7,
          }}
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />

        <div className="mt-2 text-xs" style={{ color: "var(--text-muted)", fontSize: "0.62rem" }}>
          {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </motion.div>
  );
}
