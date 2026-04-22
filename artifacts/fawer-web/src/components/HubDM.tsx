import { useEffect, useRef, useState } from "react";
import type { MeData } from "../hooks/useMe";

interface HubUser {
  userId: string;
  name: string;
  avatar: string | null;
  messageCount: number;
  lastActivity: string | null;
  lastPreview: string | null;
  inGuild: boolean;
  hasMemory: boolean;
}

interface MsgAttachment {
  url: string;
  filename?: string;
  type?: string;
}

interface MemoryEntry {
  id?: string;
  role: string;
  content: string;
  timestamp?: string;
  attachments?: MsgAttachment[];
  source?: "memory" | "discord";
}

const S = {
  panel: {
    border: "1px solid var(--border-dim)",
    background: "var(--bg2)",
    borderRadius: 2,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
    height: 560,
  },
  header: {
    padding: "10px 14px",
    borderBottom: "1px solid var(--border-dim)",
    fontFamily: "var(--mono)",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "var(--text-dim)",
    background: "var(--bg1)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  dot: (on: boolean) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: on ? "var(--green)" : "var(--border-dim)",
    boxShadow: on ? "0 0 6px var(--green)" : "none",
    flexShrink: 0,
  }),
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: 210,
    borderRight: "1px solid var(--border-dim)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  sidebarSearch: {
    padding: "8px 10px",
    borderBottom: "1px solid var(--border-dim)",
    background: "var(--bg1)",
  },
  searchInput: {
    width: "100%",
    background: "transparent",
    border: "1px solid var(--border-dim)",
    borderRadius: 2,
    padding: "5px 8px",
    fontFamily: "var(--mono)",
    fontSize: "0.65rem",
    color: "var(--text-bright)",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  userList: {
    flex: 1,
    overflowY: "auto" as const,
  },
  userItem: (selected: boolean) => ({
    padding: "9px 12px",
    borderBottom: "1px solid var(--border-dim)",
    cursor: "pointer",
    background: selected ? "rgba(var(--green-rgb, 0,255,128), 0.06)" : "transparent",
    borderLeft: selected ? "2px solid var(--green)" : "2px solid transparent",
    transition: "background 0.1s",
  }),
  userId: {
    fontFamily: "var(--mono)",
    fontSize: "0.62rem",
    color: "var(--text-bright)",
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userMeta: {
    fontFamily: "var(--mono)",
    fontSize: "0.58rem",
    color: "var(--text-dim)",
    marginTop: 2,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  chatHistory: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  bubble: (role: string) => ({
    maxWidth: "80%",
    alignSelf: role === "user" ? "flex-end" : "flex-start",
    background: role === "user" ? "rgba(var(--green-rgb, 0,255,128), 0.08)" : "var(--bg1)",
    border: `1px solid ${role === "user" ? "rgba(var(--green-rgb, 0,255,128), 0.25)" : "var(--border-dim)"}`,
    borderRadius: 2,
    padding: "7px 10px",
  }),
  bubbleRole: (role: string) => ({
    fontFamily: "var(--mono)",
    fontSize: "0.55rem",
    color: role === "user" ? "var(--green)" : "var(--text-dim)",
    letterSpacing: "0.1em",
    fontWeight: 700,
    marginBottom: 3,
  }),
  bubbleContent: {
    fontFamily: "var(--mono)",
    fontSize: "0.68rem",
    color: "var(--text-bright)",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  composer: {
    borderTop: "1px solid var(--border-dim)",
    padding: "10px 14px",
    background: "var(--bg1)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  textArea: {
    width: "100%",
    background: "transparent",
    border: "1px solid var(--border-dim)",
    borderRadius: 2,
    padding: "8px 10px",
    fontFamily: "var(--mono)",
    fontSize: "0.68rem",
    color: "var(--text-bright)",
    outline: "none",
    resize: "none" as const,
    boxSizing: "border-box" as const,
    minHeight: 60,
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  btn: (variant: "primary" | "ghost" | "danger") => ({
    fontFamily: "var(--mono)",
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    padding: "5px 14px",
    border: "1px solid",
    borderRadius: 2,
    cursor: "pointer",
    background:
      variant === "primary"
        ? "rgba(var(--green-rgb, 0,255,128), 0.1)"
        : "transparent",
    borderColor:
      variant === "primary"
        ? "var(--green)"
        : variant === "danger"
          ? "var(--red, #ff4444)"
          : "var(--border-dim)",
    color:
      variant === "primary"
        ? "var(--green)"
        : variant === "danger"
          ? "var(--red, #ff4444)"
          : "var(--text-dim)",
    transition: "all 0.1s",
  }),
  emptyState: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--mono)",
    fontSize: "0.65rem",
    color: "var(--text-dim)",
    letterSpacing: "0.08em",
  },
  imgPreview: {
    width: 64,
    height: 64,
    objectFit: "cover" as const,
    border: "1px solid var(--border-dim)",
    borderRadius: 2,
  },
  statusMsg: (ok: boolean) => ({
    fontFamily: "var(--mono)",
    fontSize: "0.6rem",
    color: ok ? "var(--green)" : "var(--red, #ff4444)",
    letterSpacing: "0.06em",
  }),
};

export default function HubDM({ me }: { me: MeData | null }) {
  const [users, setUsers] = useState<HubUser[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<MemoryEntry[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);
  const [text, setText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [selectedMeta, setSelectedMeta] = useState<{ name: string; avatar: string | null } | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  void me;

  // Poll users list every 15s
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/hub/users", { credentials: "include" });
        const d = (await r.json()) as { users?: HubUser[] };
        if (!cancelled) setUsers(d.users ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Poll conversation every 5s when a user is selected
  useEffect(() => {
    if (!selectedId) {
      setConversation([]);
      setSelectedMeta(null);
      return;
    }
    let cancelled = false;
    let firstLoad = true;
    const load = async () => {
      if (firstLoad) setLoadingConv(true);
      try {
        const r = await fetch(`/api/hub/conversation/${selectedId}`, { credentials: "include" });
        const d = (await r.json()) as {
          messages?: MemoryEntry[];
          name?: string;
          avatar?: string | null;
        };
        if (cancelled) return;
        setConversation(d.messages ?? []);
        setSelectedMeta({ name: d.name ?? selectedId, avatar: d.avatar ?? null });
      } catch {
        /* ignore */
      } finally {
        if (!cancelled && firstLoad) {
          setLoadingConv(false);
          firstLoad = false;
        }
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedId]);

  useEffect(() => {
    if (autoScroll && historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [conversation, autoScroll]);

  const handleScroll = () => {
    const el = historyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageBase64(null);
    setImageName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async () => {
    if (!selectedId || (!text.trim() && !imageBase64)) return;
    setSending(true);
    setStatus(null);
    try {
      if (imageBase64) {
        const res = await fetch("/api/hub/dm/image", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedId,
            base64: imageBase64,
            filename: imageName || "imagem.png",
            caption: text.trim() || undefined,
          }),
        });
        const d = await res.json() as { success?: boolean; error?: string };
        if (!res.ok || !d.success) throw new Error(d.error ?? "Erro desconhecido");
        setStatus({ msg: "✓ Imagem enviada", ok: true });
        setText("");
        clearImage();
      } else {
        const res = await fetch("/api/hub/dm", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedId, content: text.trim() }),
        });
        const d = await res.json() as { success?: boolean; error?: string };
        if (!res.ok || !d.success) throw new Error(d.error ?? "Erro desconhecido");
        setStatus({ msg: "✓ Mensagem enviada", ok: true });
        setText("");
        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: text.trim(), timestamp: new Date().toISOString() },
        ]);
      }
    } catch (err) {
      setStatus({ msg: `✗ ${err instanceof Error ? err.message : String(err)}`, ok: false });
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
  };

  const q = search.toLowerCase().trim();
  const filtered = q
    ? users.filter(
        (u) =>
          u.userId.includes(q) ||
          u.name.toLowerCase().includes(q) ||
          (u.lastPreview ?? "").toLowerCase().includes(q),
      )
    : users;

  const selected = users.find((u) => u.userId === selectedId) ?? null;
  const selectedName = selectedMeta?.name || selected?.name || selectedId || "";
  const selectedAvatar = selectedMeta?.avatar || selected?.avatar || null;
  const memCount = users.filter((u) => u.hasMemory).length;

  return (
    <div id="hub-dm">
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "var(--text-dim)",
          }}
        >
          HUB_DM · PAINEL DE MENSAGENS DIRETAS
        </span>
      </div>

      <div style={S.panel}>
        <div style={S.header}>
          <div style={S.dot(!loadingUsers)} />
          DM_BROADCASTER · {memCount} COM HISTÓRICO · {users.length} TOTAL
          <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: "0.55rem" }}>
            ⟳ AUTO 5s
          </span>
        </div>

        <div style={S.body}>
          {/* Sidebar — user list */}
          <div style={S.sidebar}>
            <div style={S.sidebarSearch}>
              <input
                style={S.searchInput}
                placeholder="Filtrar usuários..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={S.userList}>
              {loadingUsers && (
                <div style={{ ...S.emptyState, padding: 20, fontSize: "0.6rem" }}>
                  CARREGANDO...
                </div>
              )}
              {!loadingUsers && filtered.length === 0 && (
                <div style={{ ...S.emptyState, padding: 20, fontSize: "0.6rem" }}>
                  NENHUM USUÁRIO
                </div>
              )}
              {filtered.map((u) => (
                <div
                  key={u.userId}
                  style={S.userItem(u.userId === selectedId)}
                  onClick={() => setSelectedId(u.userId)}
                  title={u.userId}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt=""
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          border: "1px solid var(--border-dim)",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "var(--bg1)",
                          border: "1px solid var(--border-dim)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={S.userId}>{u.name}</div>
                      <div style={S.userMeta}>
                        {u.hasMemory ? `${u.messageCount} msgs` : "sem histórico"}
                      </div>
                    </div>
                  </div>
                  {u.lastPreview && (
                    <div style={{ ...S.userMeta, marginTop: 4, opacity: 0.75 }}>
                      {u.lastPreview.slice(0, 50)}…
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div style={S.chatArea}>
            {!selectedId ? (
              <div style={S.emptyState}>← SELECIONE UM USUÁRIO</div>
            ) : (
              <>
                {/* Chat header com avatar */}
                <div
                  style={{
                    padding: "8px 14px",
                    borderBottom: "1px solid var(--border-dim)",
                    background: "var(--bg1)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {selectedAvatar && (
                    <img
                      src={selectedAvatar}
                      alt=""
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        border: "1px solid var(--border-dim)",
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "var(--text-bright)",
                      }}
                    >
                      {selectedName}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "0.55rem",
                        color: "var(--text-dim)",
                        opacity: 0.8,
                      }}
                    >
                      ID: {selectedId}
                    </div>
                  </div>
                </div>

                {/* Chat history */}
                <div ref={historyRef} style={S.chatHistory} onScroll={handleScroll}>
                  {loadingConv && (
                    <div style={{ ...S.emptyState, margin: "auto" }}>CARREGANDO...</div>
                  )}
                  {!loadingConv && conversation.length === 0 && (
                    <div style={{ ...S.emptyState, margin: "auto" }}>
                      SEM HISTÓRICO · ENVIE A PRIMEIRA MENSAGEM
                    </div>
                  )}
                  {conversation.map((m, i) => {
                    const isUser = m.role === "user";
                    const cleanContent = isUser
                      ? m.content.replace(/^\[Canal:[^\]]+\]\s*/, "")
                      : m.content;
                    return (
                      <div key={m.id ?? i} style={S.bubble(m.role)}>
                        <div style={S.bubbleRole(m.role)}>
                          {isUser ? `${selectedName.toUpperCase()}` : "FAWERS"}
                          {m.source === "discord" && (
                            <span style={{ marginLeft: 6, opacity: 0.55 }}>· DM</span>
                          )}
                          {m.source === "memory" && (
                            <span style={{ marginLeft: 6, opacity: 0.55 }}>· LOG</span>
                          )}
                        </div>
                        {cleanContent && (
                          <div style={S.bubbleContent}>{cleanContent}</div>
                        )}
                        {m.attachments?.map((a, ai) => {
                          const isImg =
                            a.type?.startsWith("image/") ||
                            /\.(png|jpe?g|gif|webp)$/i.test(a.filename ?? a.url);
                          return isImg ? (
                            <a key={ai} href={a.url} target="_blank" rel="noreferrer">
                              <img
                                src={a.url}
                                alt={a.filename ?? ""}
                                style={{
                                  maxWidth: 220,
                                  maxHeight: 220,
                                  borderRadius: 2,
                                  border: "1px solid var(--border-dim)",
                                  marginTop: 6,
                                  display: "block",
                                }}
                              />
                            </a>
                          ) : (
                            <a
                              key={ai}
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: "0.6rem",
                                color: "var(--green)",
                                marginTop: 4,
                                display: "inline-block",
                              }}
                            >
                              📎 {a.filename ?? "anexo"}
                            </a>
                          );
                        })}
                        {m.timestamp && (
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: "0.52rem",
                              color: "var(--text-dim)",
                              marginTop: 4,
                              opacity: 0.7,
                            }}
                          >
                            {new Date(m.timestamp).toLocaleString("pt-BR")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Composer */}
                <div style={S.composer}>
                  {imageBase64 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img src={imageBase64} alt="preview" style={S.imgPreview} />
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: "0.6rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          {imageName}
                        </div>
                        <button style={S.btn("danger")} onClick={clearImage}>
                          ✕ REMOVER
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    style={S.textArea}
                    placeholder={
                      imageBase64
                        ? "Legenda opcional... (Ctrl+Enter para enviar)"
                        : "Escreva uma mensagem... (Ctrl+Enter para enviar)"
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKey}
                  />

                  <div style={S.actions}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                    <button style={S.btn("ghost")} onClick={() => fileRef.current?.click()}>
                      📎 IMAGEM
                    </button>
                    <button
                      style={{
                        ...S.btn("primary"),
                        opacity: sending ? 0.6 : 1,
                        cursor: sending ? "not-allowed" : "pointer",
                      }}
                      onClick={send}
                      disabled={sending}
                    >
                      {sending ? "ENVIANDO..." : "▶ ENVIAR"}
                    </button>
                    {status && (
                      <span style={S.statusMsg(status.ok)}>{status.msg}</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
