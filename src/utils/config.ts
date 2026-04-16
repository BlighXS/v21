import { logger } from "./logger.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    logger.error(`Missing required env: ${name}`);
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function listFromEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function boolFromEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return ["1", "true", "yes", "y"].includes(raw.toLowerCase());
}

export const config = {
  DISCORD_TOKEN: required("DISCORD_TOKEN"),
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ?? "",
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID ?? "",
  ADMIN_ROLE_IDS: listFromEnv("ADMIN_ROLE_IDS"),
  RESTART_ROLE_IDS: listFromEnv("RESTART_ROLE_IDS"),
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID ?? "",
  LOG_FILE: process.env.LOG_FILE ?? "",
  DASHBOARD_TOKEN: process.env.DASHBOARD_TOKEN ?? "",
  DASHBOARD_PORT: process.env.DASHBOARD_PORT ?? process.env.PORT ?? "3000",
  DASHBOARD_BIND: process.env.DASHBOARD_BIND ?? "0.0.0.0",
  DASHBOARD_GUILD_ID: process.env.DASHBOARD_GUILD_ID ?? "",
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ?? "",
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ?? "",
  SPOTIFY_TEXT_CHANNEL_ID: process.env.SPOTIFY_TEXT_CHANNEL_ID ?? "",
  TRAIN_CHANNEL_ID: process.env.TRAIN_CHANNEL_ID ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5.2",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? "llama3.2:1b-instruct-q4_K_M",
  OLLAMA_HOST: process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434",
  ALLOWED_DOMAINS: listFromEnv("ALLOWED_DOMAINS"),
  ALLOW_INSECURE_HTTP: boolFromEnv("ALLOW_INSECURE_HTTP", false),
  BLOCK_PRIVATE_IPS: boolFromEnv("BLOCK_PRIVATE_IPS", true),
  ENABLE_PREFIX: boolFromEnv("ENABLE_PREFIX", true),
  PREFIX: process.env.PREFIX || ";"
};
