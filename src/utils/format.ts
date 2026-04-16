import { EmbedBuilder, Colors } from "discord.js";

export type StyleKind = "info" | "ok" | "warn" | "error" | "action";

const STYLE = {
  info: { emoji: "??", color: Colors.Blue },
  ok: { emoji: "?", color: Colors.Green },
  warn: { emoji: "??", color: Colors.Yellow },
  error: { emoji: "?", color: Colors.Red },
  action: { emoji: "??", color: Colors.Purple }
};

export function buildEmbed(title: string, body: string, kind: StyleKind = "info") {
  const style = STYLE[kind];
  const safeBody = truncate(body, 3800);
  return new EmbedBuilder()
    .setTitle(`${style.emoji} ${title}`)
    .setDescription(safeBody)
    .setColor(style.color)
    .setFooter({ text: "Fawer'Bot | Fawer Blight" })
    .setTimestamp(new Date());
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 10) + "...";
}
