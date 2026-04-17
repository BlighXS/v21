import { motion } from "framer-motion";
import { Plus, MessageSquare, ChevronDown, LogOut, LogIn } from "lucide-react";
import { useState } from "react";
import { getAvatarUrl, type AuthUser, type Model } from "../lib/api";
import type { Conversation } from "../hooks/useChat";

interface Props {
  user: AuthUser | null;
  guestLeft: number;
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConv: (id: string) => void;
  onNewConv: () => void;
  models: Model[];
  activeModel: string;
  onSelectModel: (id: string) => void;
  onLogout: () => void;
  onLoginWithDiscord: () => void;
}

export default function Sidebar({
  user,
  guestLeft,
  conversations,
  activeConvId,
  onSelectConv,
  onNewConv,
  models,
  activeModel,
  onSelectModel,
  onLogout,
  onLoginWithDiscord,
}: Props) {
  const [modelOpen, setModelOpen] = useState(false);
  const activeModelData = models.find((m) => m.id === activeModel);
  const displayName = user?.authenticated
    ? (user.globalName || user.username || "Usuário")
    : "Convidado";

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--bg-elevated)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: "1px solid var(--bg-elevated)" }}>
        <div
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{
            width: 34,
            height: 34,
            background: "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
            boxShadow: "0 2px 12px rgba(124,110,230,0.25)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 36 36" fill="none">
            <path d="M18 4L32 28H4L18 4Z" fill="white" opacity="0.95" />
            <circle cx="18" cy="20" r="4" fill="white" opacity="0.55" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            FAWER AI
          </div>
          {user?.isOwner && (
            <div className="text-xs font-medium" style={{ color: "var(--accent)", fontSize: "0.65rem" }}>
              Proprietário
            </div>
          )}
        </div>
      </div>

      {/* Model selector */}
      <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--bg-elevated)" }}>
        <div className="text-xs font-semibold mb-2 px-1" style={{ color: "var(--text-muted)", letterSpacing: "0.05em", fontSize: "0.65rem" }}>
          MODELO ATIVO
        </div>
        <div className="relative">
          <button
            onClick={() => setModelOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-all hover:opacity-90"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--bg-border)",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">{activeModelData?.icon ?? "🤖"}</span>
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {activeModelData?.name ?? "Selecionar"}
              </span>
            </div>
            <motion.div animate={{ rotate: modelOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
              <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
            </motion.div>
          </button>

          <motion.div
            initial={false}
            animate={modelOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="mt-1 rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--bg-border)", background: "var(--bg-elevated)" }}
            >
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.available) { onSelectModel(m.id); setModelOpen(false); }
                  }}
                  disabled={!m.available}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    opacity: m.available ? 1 : 0.4,
                    cursor: m.available ? "pointer" : "not-allowed",
                    background: activeModel === m.id ? "rgba(124,110,230,0.12)" : "transparent",
                    borderLeft: activeModel === m.id ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (m.available && activeModel !== m.id)
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (activeModel !== m.id)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span className="text-base">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        {m.name}
                      </span>
                      <span
                        className="text-xs rounded-md px-1.5 py-0.5"
                        style={{
                          background: activeModel === m.id ? "var(--accent)" : "var(--bg-border)",
                          color: activeModel === m.id ? "white" : "var(--text-muted)",
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          letterSpacing: "0.03em",
                        }}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>
                      {m.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* New chat button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewConv}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
            color: "white",
            boxShadow: "0 2px 16px rgba(124,110,230,0.3)",
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Nova conversa
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
        {conversations.length === 0 && (
          <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>
            Nenhuma conversa ainda
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelectConv(conv.id)}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all"
            style={{
              background: activeConvId === conv.id ? "rgba(124,110,230,0.12)" : "transparent",
              borderLeft: activeConvId === conv.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeConvId === conv.id ? "var(--text-primary)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (activeConvId !== conv.id)
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (activeConvId !== conv.id)
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span className="text-xs truncate" style={{ lineHeight: 1.4 }}>{conv.title}</span>
          </button>
        ))}
      </div>

      {/* Guest counter badge (only when guest) */}
      {user?.guest && (
        <div className="px-3 pb-2">
          <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Mensagens restantes
              </div>
              <div
                className="rounded-full overflow-hidden"
                style={{ height: 3, background: "var(--bg-border)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: guestLeft <= 1 ? "var(--danger)" : guestLeft <= 2 ? "var(--warning)" : "var(--accent)",
                  }}
                  animate={{ width: `${(guestLeft / 5) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
            <span
              className="font-bold text-sm flex-shrink-0"
              style={{
                color: guestLeft <= 1 ? "var(--danger)" : guestLeft <= 2 ? "var(--warning)" : "var(--accent)",
              }}
            >
              {guestLeft}/5
            </span>
          </div>
        </div>
      )}

      {/* User section */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--bg-elevated)" }}>
        <div
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
          style={{ background: "var(--bg-elevated)" }}
        >
          {user?.authenticated && user.discordId ? (
            <img
              src={getAvatarUrl(user.discordId, user.avatar)}
              alt="avatar"
              className="rounded-full flex-shrink-0"
              style={{ width: 30, height: 30 }}
            />
          ) : (
            <div
              className="rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ width: 30, height: 30, background: "var(--bg-border)", color: "var(--text-secondary)" }}
            >
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
              {user?.authenticated ? (user.isOwner ? "Proprietário ✦" : "Membro") : "Conta de convidado"}
            </div>
          </div>
          {user?.authenticated ? (
            <button
              onClick={onLogout}
              title="Sair"
              className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              <LogOut size={13} />
            </button>
          ) : (
            <button
              onClick={onLoginWithDiscord}
              title="Entrar com Discord"
              className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "#5865F2" }}
            >
              <LogIn size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
