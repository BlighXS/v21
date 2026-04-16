import { EmbedBuilder, Colors } from "discord.js";

export type StyleKind = "info" | "ok" | "warn" | "error" | "action";

const STYLE = {
  info:   { emoji: "\u2139\uFE0F", color: Colors.Blue },
  ok:     { emoji: "\u2705",       color: Colors.Green },
  warn:   { emoji: "\u26A0\uFE0F", color: Colors.Yellow },
  error:  { emoji: "\u274C",       color: Colors.Red },
  action: { emoji: "\u26A1",       color: Colors.Purple }
};

export function buildEmbed(title: string, body: string, kind: StyleKind = "info") {
  const style = STYLE[kind];
  const safeBody = truncate(body, 3800);
  return new EmbedBuilder()
    .setTitle(`${style.emoji} ${title}`)
    .setDescription(safeBody)
    .setColor(style.color)
    .setFooter({ text: "Fawer\u2019Bot \u2022 Fawer Blight" })
    .setTimestamp(new Date());
}

export function buildEmbedFields(
  title: string,
  fields: { name: string; value: string; inline?: boolean }[],
  kind: StyleKind = "info",
  description?: string
) {
  const style = STYLE[kind];
  const embed = new EmbedBuilder()
    .setTitle(`${style.emoji} ${title}`)
    .setColor(style.color)
    .setFooter({ text: "Fawer\u2019Bot \u2022 Fawer Blight" })
    .setTimestamp(new Date());

  if (description) embed.setDescription(truncate(description, 2000));
  embed.addFields(fields.map((f) => ({ ...f, value: truncate(f.value, 1024) })));
  return embed;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 10) + "...";
}

export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts: string[] = [];
  if (days)    parts.push(`${days}d`);
  if (hours || parts.length) parts.push(`${hours}h`);
  if (minutes || parts.length) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
