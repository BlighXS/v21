import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, PanelLeft, Plus, Zap } from "lucide-react";
import MessageBubble from "./MessageBubble";
import type { Conversation } from "../hooks/useChat";
import type { Model } from "../lib/api";

interface Props {
  conversation: Conversation | null;
  isLoading: boolean;
  onSend: (text: string) => void;
  onNewConv: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  disabled: boolean;
  activeModel: string;
  models: Model[];
}

const MODEL_NAMES: Record<string, string> = {
  ollama: "FAWER Beta",
  gemini: "FAWER V2",
  "gemini-v3": "FAWER V3",
  "openai-v4": "FAWER V4",
};

const SUGGESTIONS = [
  "Quem é você?",
  "Me explique inteligência artificial",
  "Escreva um poema criativo",
  "Como você foi construído?",
];

export default function ChatArea({
  conversation,
  isLoading,
  onSend,
  onNewConv,
  onToggleSidebar,
  sidebarOpen,
  disabled,
  activeModel,
  models,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messages = conversation?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading || disabled) return;
    setInput("");
    onSend(text);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  const activeModelName = MODEL_NAMES[activeModel] ?? "FAWER AI";
  const activeModelData = models.find((m) => m.id === activeModel);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--bg-border)" }}
      >
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg transition-colors hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
          title={sidebarOpen ? "Fechar sidebar" : "Abrir sidebar"}
        >
          <PanelLeft size={16} />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-base">{activeModelData?.icon ?? "🤖"}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {activeModelName}
          </span>
        </div>

        <div className="flex-1" />

        <button
          onClick={onNewConv}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-secondary)" }}
        >
          <Plus size={12} />
          Novo chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center rounded-2xl mb-4"
                style={{
                  width: 56,
                  height: 56,
                  background: "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
                  boxShadow: "0 0 32px rgba(124,110,230,0.2)",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                  <path d="M18 4L32 28H4L18 4Z" fill="white" opacity="0.9" />
                  <circle cx="18" cy="20" r="4" fill="white" opacity="0.6" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                FAWER AI
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Com o que posso te ajudar hoje?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  disabled={disabled}
                  className="text-left rounded-xl p-3 text-xs transition-all hover:opacity-80 active:scale-[0.97]"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--bg-border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Zap size={10} className="mb-1 opacity-50" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 px-4 py-1.5"
          >
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 28,
                height: 28,
                background: "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
                marginTop: 2,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 36 36" fill="none">
                <path d="M18 4L32 28H4L18 4Z" fill="white" opacity="0.9" />
                <circle cx="18" cy="20" r="3" fill="white" opacity="0.6" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 py-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full typing-dot"
                  style={{ background: "var(--accent)" }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div
          className="relative flex items-end gap-2 rounded-2xl p-3"
          style={{
            background: "var(--bg-surface)",
            border: disabled
              ? "1px solid rgba(248,113,113,0.3)"
              : "1px solid var(--bg-border)",
            transition: "border-color 0.2s",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = disabled
              ? "rgba(248,113,113,0.4)"
              : "rgba(124,110,230,0.4)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = disabled
              ? "rgba(248,113,113,0.3)"
              : "var(--bg-border)";
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            placeholder={disabled ? "Limite atingido — faça login para continuar" : "Mensagem para FAWER AI…"}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed"
            style={{
              color: disabled ? "var(--text-muted)" : "var(--text-primary)",
              caretColor: "var(--accent)",
              maxHeight: 180,
              overflow: "auto",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || disabled}
            className="flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{
              width: 34,
              height: 34,
              background:
                !input.trim() || isLoading || disabled
                  ? "var(--bg-border)"
                  : "var(--accent)",
              color: !input.trim() || isLoading || disabled ? "var(--text-muted)" : "white",
              cursor: !input.trim() || isLoading || disabled ? "not-allowed" : "pointer",
            }}
          >
            <Send size={14} />
          </button>
        </div>
        <div className="text-center mt-2 text-xs" style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}>
          FAWER AI pode cometer erros. Verifique informações importantes.
        </div>
      </div>
    </div>
  );
}
