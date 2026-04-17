import { motion } from "framer-motion";
import { Plus, MessageSquare, ChevronDown, LogOut, LogIn, Settings } from "lucide-react";
import { useState } from "react";
import { getAvatarUrl, type AuthUser, type Model } from "../lib/api";
import type { Conversation } from "../hooks/useChat";

interface Props {
  user: AuthUser | null;
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

  const displayName =
    user?.authenticated
      ? (user.globalName || user.username || "Usuário")
      : "Convidado";

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--bg-border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: "1px solid var(--bg-border)" }}>
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            background: "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 36 36" fill="none">
            <path d="M18 4L32 28H4L18 4Z" fill="white" opacity="0.9" />
            <circle cx="18" cy="20" r="4" fill="white" opacity="0.6" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            FAWER AI
          </div>
          {user?.isOwner && (
            <div className="text-xs" style={{ color: "var(--accent)" }}>
              Proprietário
            </div>
          )}
        </div>
      </div>

      {/* Model selector */}
      <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--bg-border)" }}>
        <div className="text-xs font-medium mb-2 px-1" style={{ color: "var(--text-muted)" }}>
          MODELO ATIVO
        </div>
        <div className="relative">
          <button
            onClick={() => setModelOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">{activeModelData?.icon ?? "🤖"}</span>
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {activeModelData?.name ?? "Selecionar"}
              </span>
            </div>
            <motion.div animate={{ rotate: modelOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
            </motion.div>
          </button>

          <motion.div
            initial={false}
            animate={modelOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
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
                    if (m.available) {
                      onSelectModel(m.id);
                      setModelOpen(false);
                    }
                  }}
                  disabled={!m.available}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                  style={{
                    opacity: m.available ? 1 : 0.4,
                    cursor: m.available ? "pointer" : "not-allowed",
                    background: activeModel === m.id ? "var(--accent-glow)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (m.available && activeModel !== m.id) {
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeModel !== m.id) {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }
                  }}
                >
                  <span className="text-base">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {m.name}
                      </span>
                      <span
                        className="text-xs rounded px-1 py-0.5"
                        style={{
                          background: activeModel === m.id ? "var(--accent)" : "var(--bg-border)",
                          color: activeModel === m.id ? "white" : "var(--text-muted)",
                          fontSize: "0.65rem",
                          fontWeight: 600,
                        }}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
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
      <div className="px-3 py-3">
        <button
          onClick={onNewConv}
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus size={15} />
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
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors"
            style={{
              background: activeConvId === conv.id ? "var(--accent-glow)" : "transparent",
              border: activeConvId === conv.id ? "1px solid rgba(124,110,230,0.2)" : "1px solid transparent",
              color: activeConvId === conv.id ? "var(--text-primary)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (activeConvId !== conv.id) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (activeConvId !== conv.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
            <span className="text-xs truncate">{conv.title}</span>
          </button>
        ))}
      </div>

      {/* User section */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--bg-border)" }}>
        <div
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
          style={{ background: "var(--bg-elevated)" }}
        >
          {user?.authenticated && user.discordId ? (
            <img
              src={getAvatarUrl(user.discordId, user.avatar)}
              alt="avatar"
              className="rounded-full flex-shrink-0"
              style={{ width: 28, height: 28 }}
            />
          ) : (
            <div
              className="rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ width: 28, height: 28, background: "var(--bg-border)", color: "var(--text-muted)" }}
            >
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
              {user?.authenticated ? (user.isOwner ? "Proprietário" : "Membro") : "Convidado"}
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
