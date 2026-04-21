import { useState, useRef, useEffect, useCallback } from "react";

interface PendingWrite {
  id: string;
  path: string;
  diff: string;
  addedLines: number;
  removedLines: number;
  diffTruncated: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reports?: string[];
  pendingWrites?: PendingWrite[];
  confirmedPaths?: string[];
  timestamp: number;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as T;
  return data;
}

function DiffViewer({ diff }: { diff: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = diff.split("\n");
  const preview = expanded ? lines : lines.slice(0, 30);
  return (
    <div>
      <pre
        style={{
          margin: 0,
          padding: "8px",
          background: "#0a0a0a",
          borderRadius: 4,
          fontSize: "0.65rem",
          lineHeight: 1.4,
          overflowX: "auto",
          maxHeight: expanded ? 400 : 200,
          overflowY: "auto",
          fontFamily: "var(--mono, monospace)",
        }}
      >
        {preview.map((line, i) => {
          const color =
            line.startsWith("+ ") ? "#00ff88" :
            line.startsWith("- ") ? "#ff4444" :
            "#888";
          return (
            <span key={i} style={{ display: "block", color }}>
              {line || "\u00a0"}
            </span>
          );
        })}
      </pre>
      {lines.length > 30 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: 4,
            background: "none",
            border: "none",
            color: "#00ff88",
            fontFamily: "var(--mono, monospace)",
            fontSize: "0.65rem",
            cursor: "pointer",
            padding: 0,
            letterSpacing: "0.05em",
          }}
        >
          {expanded ? "▲ COLAPSAR" : `▼ VER MAIS (+${lines.length - 30} linhas)`}
        </button>
      )}
    </div>
  );
}

function PendingWriteCard({
  pw,
  onConfirm,
  onCancel,
}: {
  pw: PendingWrite;
  onConfirm: (id: string, path: string) => void;
  onCancel: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<"confirmed" | "cancelled" | null>(null);

  if (done === "confirmed") {
    return (
      <div style={{ padding: "6px 8px", background: "#001a0e", border: "1px solid #00ff88", borderRadius: 4, fontSize: "0.65rem", color: "#00ff88", fontFamily: "var(--mono, monospace)" }}>
        ✅ {pw.path} — escrito com sucesso
      </div>
    );
  }
  if (done === "cancelled") {
    return (
      <div style={{ padding: "6px 8px", background: "#1a0000", border: "1px solid #ff4444", borderRadius: 4, fontSize: "0.65rem", color: "#ff4444", fontFamily: "var(--mono, monospace)" }}>
        ✗ {pw.path} — cancelado
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 6,
        padding: "8px",
        background: "#111",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.65rem", color: "#00ff88" }}>
          📝 {pw.path}
        </span>
        <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.6rem", color: "#666" }}>
          +{pw.addedLines} / -{pw.removedLines}
        </span>
      </div>
      <DiffViewer diff={pw.diff} />
      {pw.diffTruncated && (
        <div style={{ fontSize: "0.6rem", color: "#666", fontFamily: "var(--mono, monospace)" }}>
          [diff truncado — arquivo completo será escrito]
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled={confirming}
          onClick={async () => {
            setConfirming(true);
            try {
              await apiPost(`/api/agent/confirm/${pw.id}`, {});
              setDone("confirmed");
              onConfirm(pw.id, pw.path);
            } catch {
              setConfirming(false);
            }
          }}
          style={{
            flex: 1,
            padding: "5px 0",
            background: "#001a0e",
            border: "1px solid #00ff88",
            color: "#00ff88",
            fontFamily: "var(--mono, monospace)",
            fontSize: "0.65rem",
            letterSpacing: "0.08em",
            cursor: confirming ? "wait" : "pointer",
            borderRadius: 3,
          }}
        >
          {confirming ? "ESCREVENDO..." : "✅ CONFIRMAR"}
        </button>
        <button
          disabled={confirming}
          onClick={async () => {
            await apiPost(`/api/agent/cancel/${pw.id}`, {});
            setDone("cancelled");
            onCancel(pw.id);
          }}
          style={{
            flex: 1,
            padding: "5px 0",
            background: "#1a0000",
            border: "1px solid #ff4444",
            color: "#ff4444",
            fontFamily: "var(--mono, monospace)",
            fontSize: "0.65rem",
            letterSpacing: "0.08em",
            cursor: "pointer",
            borderRadius: 3,
          }}
        >
          ✗ CANCELAR
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onConfirm, onCancel }: {
  msg: ChatMessage;
  onConfirm: (id: string, path: string) => void;
  onCancel: (id: string) => void;
}) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) {
    return (
      <div style={{
        textAlign: "center",
        fontSize: "0.6rem",
        color: "#555",
        fontFamily: "var(--mono, monospace)",
        letterSpacing: "0.05em",
        padding: "4px 0",
      }}>
        {msg.content}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 4,
      }}
    >
      <div
        style={{
          maxWidth: "88%",
          padding: "8px 12px",
          borderRadius: isUser ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
          background: isUser ? "#001a0e" : "#111",
          border: `1px solid ${isUser ? "#00ff88" : "#222"}`,
          color: isUser ? "#00ff88" : "#ccc",
          fontFamily: "var(--mono, monospace)",
          fontSize: "0.7rem",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {msg.content}
      </div>

      {msg.reports && msg.reports.length > 0 && (
        <div
          style={{
            maxWidth: "88%",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {msg.reports.map((r, i) => (
            <div
              key={i}
              style={{
                padding: "4px 8px",
                background: "#0d0d0d",
                border: "1px solid #2a2a2a",
                borderRadius: 4,
                fontSize: "0.62rem",
                color: "#aaa",
                fontFamily: "var(--mono, monospace)",
              }}
            >
              {r}
            </div>
          ))}
        </div>
      )}

      {msg.pendingWrites && msg.pendingWrites.length > 0 && (
        <div style={{ maxWidth: "96%", width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
          {msg.pendingWrites.map((pw) => (
            <PendingWriteCard key={pw.id} pw={pw} onConfirm={onConfirm} onCancel={onCancel} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      content: "AGENTE ATIVO — ACESSO TOTAL AO CÓDIGO DO BOT",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const historyForApi = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const data = await apiPost<{
        reply?: string;
        reports?: string[];
        pendingWrites?: PendingWrite[];
        error?: string;
      }>("/api/agent/chat", { message: text, history: historyForApi });

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { id: `err_${Date.now()}`, role: "system", content: `ERRO: ${data.error}`, timestamp: Date.now() },
        ]);
      } else {
        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.reply || "(sem resposta de texto)",
          reports: data.reports,
          pendingWrites: data.pendingWrites,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, role: "system", content: `ERRO DE REDE: ${String(err)}`, timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const onConfirm = (id: string, path: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.pendingWrites?.some((pw) => pw.id === id)
          ? {
              ...m,
              reports: [...(m.reports || []), `✅ \`${path}\` confirmado — bot reiniciando...`],
            }
          : m
      )
    );
  };

  const onCancel = (id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.pendingWrites?.some((pw) => pw.id === id)
          ? {
              ...m,
              reports: [...(m.reports || []), `✗ escrita cancelada (${id})`],
            }
          : m
      )
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="ChatBOT — Agente de controle do bot"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: open ? "#00ff88" : "#0a0a0a",
          color: open ? "#000" : "#00ff88",
          border: "1px solid #00ff88",
          borderRadius: 6,
          padding: "8px 14px",
          fontFamily: "var(--mono, monospace)",
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          cursor: "pointer",
          boxShadow: open ? "0 0 20px rgba(0,255,136,0.4)" : "0 0 10px rgba(0,255,136,0.15)",
          transition: "all 0.15s ease",
          userSelect: "none",
        }}
      >
        {open ? "✕ FECHAR" : "⬛ CHATBOT"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 70,
            right: 24,
            zIndex: 9998,
            width: 420,
            maxWidth: "calc(100vw - 48px)",
            height: "min(600px, calc(100vh - 100px))",
            background: "#0d0d0d",
            border: "1px solid #00ff88",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 0 40px rgba(0,255,136,0.1), 0 8px 32px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid #1a1a1a",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#111",
              flexShrink: 0,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 6px #00ff88" }} />
            <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.68rem", color: "#00ff88", letterSpacing: "0.1em", fontWeight: 700 }}>
              CHATBOT — AGENTE CONTROLADOR
            </span>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              scrollBehavior: "smooth",
            }}
          >
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onConfirm={onConfirm} onCancel={onCancel} />
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    padding: "8px 14px",
                    background: "#111",
                    border: "1px solid #222",
                    borderRadius: "10px 10px 10px 2px",
                    fontFamily: "var(--mono, monospace)",
                    fontSize: "0.68rem",
                    color: "#00ff88",
                    letterSpacing: "0.05em",
                  }}
                >
                  processando
                  <span
                    style={{
                      display: "inline-block",
                      animation: "blink 1s step-end infinite",
                    }}
                  >
                    ...
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div
            style={{
              borderTop: "1px solid #1a1a1a",
              padding: "10px",
              background: "#111",
              flexShrink: 0,
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Descreva o que criar ou modificar no bot... (Enter para enviar)"
              rows={2}
              style={{
                flex: 1,
                background: "#0a0a0a",
                border: "1px solid #222",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#ccc",
                fontFamily: "var(--mono, monospace)",
                fontSize: "0.68rem",
                lineHeight: 1.5,
                resize: "none",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#00ff88"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#222"; }}
              disabled={loading}
            />
            <button
              onClick={() => void handleSend()}
              disabled={loading || !input.trim()}
              style={{
                padding: "8px 14px",
                background: loading || !input.trim() ? "#111" : "#001a0e",
                border: "1px solid #00ff88",
                color: loading || !input.trim() ? "#444" : "#00ff88",
                fontFamily: "var(--mono, monospace)",
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
                cursor: loading || !input.trim() ? "default" : "pointer",
                borderRadius: 6,
                transition: "all 0.15s",
                flexShrink: 0,
                height: "fit-content",
              }}
            >
              ENVIAR
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
