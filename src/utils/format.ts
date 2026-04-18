import { EmbedBuilder, Colors } from "discord.js";

export type StyleKind = "info" | "ok" | "warn" | "error" | "action";

const STYLE: Record<StyleKind, { emoji: string; color: number }> = {
  info: { emoji: "ℹ️", color: Colors.Blue },
  ok: { emoji: "✅", color: Colors.Green },
  warn: { emoji: "⚠️", color: Colors.Yellow },
  error: { emoji: "❌", color: Colors.Red },
  action: { emoji: "⚡", color: Colors.Purple },
};

const MAX_DESC = 4096;
const MAX_FIELD = 1024;
const MAX_TOTAL = 6000;

// ================= EMBED =================

export function buildEmbed(
  title: string,
  body: string,
  kind: StyleKind = "info",
) {
  const style = STYLE[kind];

  const safeTitle = truncate(title, 256);
  const safeBody = truncate(body, MAX_DESC);

  return new EmbedBuilder()
    .setTitle(`${style.emoji} ${safeTitle}`)
    .setDescription(safeBody)
    .setColor(style.color)
    .setFooter({ text: "Fawer’Bot • Fawer Blight" })
    .setTimestamp();
}

export function buildEmbedFields(
  title: string,
  fields: { name: string; value: string; inline?: boolean }[],
  kind: StyleKind = "info",
  description?: string,
) {
  const style = STYLE[kind];

  const embed = new EmbedBuilder()
    .setTitle(`${style.emoji} ${truncate(title, 256)}`)
    .setColor(style.color)
    .setFooter({ text: "Fawer’Bot • Fawer Blight" })
    .setTimestamp();

  if (description) {
    embed.setDescription(truncate(description, MAX_DESC));
  }

  // garante limites do discord
  const safeFields = fields
    .slice(0, 25) // max fields discord
    .map((f) => ({
      name: truncate(f.name, 256),
      value: truncate(f.value, MAX_FIELD),
      inline: f.inline ?? false,
    }));

  embed.addFields(safeFields);

  return embed;
}

// ================= UTILS =================

export function truncate(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;

  return text.slice(0, Math.max(0, max - 3)) + "...";
}

export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];

  if (days) parts.push(`${days}d`);
  if (hours || parts.length) parts.push(`${hours}h`);
  if (minutes || parts.length) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
