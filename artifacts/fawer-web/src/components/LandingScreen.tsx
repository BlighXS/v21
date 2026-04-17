import { motion } from "framer-motion";
import { HelpCircle, BookOpen, Pencil, Code2 } from "lucide-react";

interface Props {
  onGuest: () => void;
  discordLoginUrl: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function LandingScreen({ onGuest, discordLoginUrl }: Props) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Ambient blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,110,230,0.07) 0%, transparent 65%)",
          top: "50%",
          left: "50%",
          transform: "translate(-55%, -55%)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(91,138,244,0.05) 0%, transparent 65%)",
          bottom: "5%",
          right: "5%",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full">
        {/* Logo */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mb-8">
          <div
            className="inline-flex items-center justify-center rounded-2xl mb-5"
            style={{
              width: 76,
              height: 76,
              background: "linear-gradient(135deg, var(--accent) 0%, #5b8af4 100%)",
              boxShadow: "0 0 48px rgba(124,110,230,0.3)",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 36 36" fill="none">
              <path d="M18 4L32 28H4L18 4Z" fill="white" opacity="0.95" />
              <circle cx="18" cy="20" r="4.5" fill="white" opacity="0.55" />
            </svg>
          </div>

          <h1
            className="text-4xl font-bold mb-2"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
          >
            FAWER AI
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Inteligência artificial avançada, ao seu alcance.
          </p>
        </motion.div>

        {/* Models row */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show" className="w-full mb-7">
          <div
            className="rounded-2xl p-3 grid grid-cols-2 gap-2"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-elevated)" }}
          >
            {[
              { icon: "🧠", name: "FAWER Beta", label: "Local · CPU" },
              { icon: "✨", name: "FAWER V2", label: "Gemini 2.5 Flash" },
              { icon: "🔮", name: "FAWER V3", label: "Gemini 3 Flash" },
              { icon: "⚡", name: "FAWER V4", label: "GPT-5.2" },
            ].map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-2.5 rounded-xl p-2.5 transition-colors"
                style={{ background: "var(--bg-elevated)" }}
              >
                <span className="text-lg leading-none">{m.icon}</span>
                <div className="text-left min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)", fontSize: "0.72rem" }}>
                    {m.name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
                    {m.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Auth options */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show" className="w-full flex flex-col gap-3">
          <a
            href={discordLoginUrl}
            className="flex items-center justify-center gap-3 rounded-2xl py-4 px-5 text-sm font-bold transition-all duration-200 hover:opacity-92 active:scale-[0.98]"
            style={{
              background: "#5865F2",
              color: "white",
              boxShadow: "0 4px 28px rgba(88,101,242,0.35)",
              letterSpacing: "-0.01em",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 71 55" fill="none">
              <path d="M60.1 4.87A58.55 58.55 0 0045.75.84a40.68 40.68 0 00-1.84 3.78 54.19 54.19 0 00-16.27 0A40.88 40.88 0 0025.8.84 58.44 58.44 0 0011.43 4.88C1.65 19.75-.99 34.22.31 48.48A58.99 58.99 0 0017.88 55c1.42-1.93 2.67-3.96 3.75-6.08a38.3 38.3 0 01-5.91-2.84c.5-.36.98-.73 1.45-1.11 11.4 5.27 23.76 5.27 35.01 0 .48.38.96.75 1.45 1.11a38.3 38.3 0 01-5.93 2.85 42.3 42.3 0 003.74 6.07 58.91 58.91 0 0017.6-6.52C70.91 32.17 67.49 17.83 60.1 4.87zM23.74 39.6c-3.5 0-6.37-3.22-6.37-7.17s2.81-7.18 6.37-7.18c3.56 0 6.44 3.23 6.37 7.18.01 3.95-2.8 7.17-6.37 7.17zm23.52 0c-3.5 0-6.37-3.22-6.37-7.17s2.81-7.18 6.37-7.18c3.56 0 6.44 3.23 6.37 7.18 0 3.95-2.81 7.17-6.37 7.17z" fill="currentColor"/>
            </svg>
            Entrar com Discord — Ilimitado
          </a>

          <button
            onClick={onGuest}
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 px-5 text-sm font-medium transition-all duration-200 hover:opacity-80 active:scale-[0.98]"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--bg-elevated)",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,110,230,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bg-elevated)";
            }}
          >
            Continuar como convidado
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", fontSize: "0.65rem" }}
            >
              5 msg
            </span>
          </button>
        </motion.div>

        <motion.p
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-5 text-xs leading-relaxed"
          style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}
        >
          Entrar com Discord = acesso ilimitado + o bot te reconhece.
        </motion.p>
      </div>
    </div>
  );
}
