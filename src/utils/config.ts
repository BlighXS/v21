import { logger } from "./logger.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    logger.error(`Missing required env: ${name}`);
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function listFromEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function boolFromEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return ["1", "true", "yes", "y"].includes(raw.toLowerCase());
}

// validação de URL simples (segurança)
function validateUrl(url: string, name: string): string {
  try {
    new URL(url);
    return url;
  } catch {
    logger.error(`Invalid URL in env: ${name}`);
    throw new Error(`Invalid URL: ${name}`);
  }
}

// validação de número
function numberFromEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;

  const num = Number(raw);
  if (isNaN(num)) {
    logger.warn(`Invalid number for ${name}, usando default`);
    return defaultValue;
  }

  return num;
}

export const config = {
  DISCORD_TOKEN: required("DISCORD_TOKEN"),

  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ?? "",
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID ?? "",

  ADMIN_ROLE_IDS: listFromEnv("ADMIN_ROLE_IDS"),
  RESTART_ROLE_IDS: listFromEnv("RESTART_ROLE_IDS"),

  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID ?? "",
  LOG_FILE: process.env.LOG_FILE ?? "",

  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ?? "",
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ?? "",
  SPOTIFY_TEXT_CHANNEL_ID: process.env.SPOTIFY_TEXT_CHANNEL_ID ?? "",

  TRAIN_CHANNEL_ID: process.env.TRAIN_CHANNEL_ID ?? "",

  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5.2",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? "llama3.2:1b",

  OLLAMA_HOST: validateUrl(
    process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434",
    "OLLAMA_HOST",
  ),

  ALLOWED_DOMAINS: listFromEnv("ALLOWED_DOMAINS"),

  ALLOW_INSECURE_HTTP: boolFromEnv("ALLOW_INSECURE_HTTP", false),
  BLOCK_PRIVATE_IPS: boolFromEnv("BLOCK_PRIVATE_IPS", true),
  ENABLE_PREFIX: boolFromEnv("ENABLE_PREFIX", true),

  PREFIX: process.env.PREFIX || ";",

  // configs extras úteis (novo)
  MAX_ACTIONS_PER_MESSAGE: numberFromEnv("MAX_ACTIONS_PER_MESSAGE", 5),
  MAX_FOLLOW_UP_PASSES: numberFromEnv("MAX_FOLLOW_UP_PASSES", 3),
  DEBUG: boolFromEnv("DEBUG", false),
} as const;
