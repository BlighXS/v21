import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./hooks/useAuth";
import { useChat } from "./hooks/useChat";
import { fetchModels, getDiscordLoginUrl, startGuestSession, type Model } from "./lib/api";
import LandingScreen from "./components/LandingScreen";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import GuestBanner from "./components/GuestBanner";

export default function App() {
  const { user, loading, refresh, logout } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [activeModel, setActiveModel] = useState("ollama");
  const [showLanding, setShowLanding] = useState(false);
  const [guestLeft, setGuestLeft] = useState<number>(5);
  const [limitReached, setLimitReached] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    void fetchModels().then(setModels);
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user || user.noSession) {
        setShowLanding(true);
      } else {
        setShowLanding(false);
        if (user.guest && user.guestMessagesLeft !== undefined) {
          setGuestLeft(user.guestMessagesLeft);
        }
      }
    }
  }, [user, loading]);

  const chat = useChat(
    activeModel,
    (left) => {
      setGuestLeft(left);
      if (user) {
        user.guestMessagesLeft = left;
      }
    },
    () => setLimitReached(true),
    user
  );

  const handleGuestMode = async () => {
    await startGuestSession();
    await refresh();
    setShowLanding(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full typing-dot"
              style={{ background: "var(--accent)", animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ background: "var(--bg-base)" }}>
      <AnimatePresence>
        {showLanding && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <LandingScreen
              onGuest={handleGuestMode}
              discordLoginUrl={getDiscordLoginUrl()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!showLanding && (
        <>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ x: -280, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -280, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="flex-shrink-0"
                style={{ width: 260 }}
              >
                <Sidebar
                  user={user}
                  guestLeft={guestLeft}
                  conversations={chat.conversations}
                  activeConvId={chat.activeConvId}
                  onSelectConv={chat.setActiveConvId}
                  onNewConv={() => chat.newConversation()}
                  models={models}
                  activeModel={activeModel}
                  onSelectModel={setActiveModel}
                  onLogout={logout}
                  onLoginWithDiscord={() => window.location.href = getDiscordLoginUrl()}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col min-w-0 relative">
            {user?.guest && !limitReached && (
              <GuestBanner
                messagesLeft={guestLeft}
                onLogin={() => window.location.href = getDiscordLoginUrl()}
              />
            )}

            {limitReached && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 text-sm text-center"
                style={{ background: "rgba(248,113,113,0.1)", borderBottom: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}
              >
                Limite de convidado atingido.{" "}
                <button
                  onClick={() => window.location.href = getDiscordLoginUrl()}
                  className="underline font-medium hover:opacity-80"
                >
                  Entrar com Discord
                </button>{" "}
                para continuar.
              </motion.div>
            )}

            <ChatArea
              conversation={chat.activeConv}
              isLoading={chat.isLoading}
              onSend={chat.sendMessage}
              onNewConv={() => chat.newConversation()}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
              sidebarOpen={sidebarOpen}
              disabled={limitReached}
              activeModel={activeModel}
              models={models}
            />
          </div>
        </>
      )}
    </div>
  );
}
