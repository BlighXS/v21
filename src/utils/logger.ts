import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

const targets: pino.TransportTargetOptions[] = [];

if (!isProd) {
  targets.push({
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
    },
  });
}

if (process.env.LOG_FILE) {
  targets.push({
    target: "pino/file",
    options: {
      destination: process.env.LOG_FILE,
      mkdir: true,
      sync: false, // evita travar event loop
    },
  });
}

let transport: pino.TransportMultiOptions | undefined;

try {
  if (targets.length) {
    transport = pino.transport({ targets });
  }
} catch (error) {
  // fallback seguro
  console.warn("Falha ao inicializar transport do logger:", error);
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",

    // timestamp padronizado (melhor pra parsing)
    timestamp: pino.stdTimeFunctions.isoTime,

    // evita vazar dados sensíveis
    redact: {
      paths: [
        "token",
        "authorization",
        "password",
        "*.token",
        "*.authorization",
        "*.password",
      ],
      censor: "[REDACTED]",
    },

    // reduz overhead em produção
    base: isProd ? undefined : { pid: process.pid },
  },
  transport,
);
