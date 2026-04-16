import pino from "pino";

const targets = [];
const isProd = process.env.NODE_ENV === "production";

if (!isProd) {
  targets.push({
    target: "pino-pretty",
    options: { colorize: true }
  });
}

if (process.env.LOG_FILE) {
  targets.push({
    target: "pino/file",
    options: { destination: process.env.LOG_FILE, mkdir: true }
  });
}

const transport = targets.length ? pino.transport({ targets }) : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info"
  },
  transport
);
