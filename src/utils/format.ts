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

/**
 * Quebra um texto longo em pedaços enviáveis no Discord (limite real: 2000).
 * Estratégia (do mais "limpo" pro mais bruto):
 *   1. Tenta quebrar em blocos separados por linha em branco (`\n\n`) — preserva tópicos.
 *   2. Se um bloco ainda for grande, quebra por linha simples (`\n`).
 *   3. Se uma linha for maior que o limite, corta por palavras.
 *   4. Em última instância, corta no caractere.
 * Também garante que blocos de código (```...```) não fiquem partidos no meio:
 *   se um chunk abrir ``` mas não fechar, fecha no fim e reabre no próximo.
 */
export function chunkForDiscord(text: string, max = 1900): string[] {
  if (!text) return [];
  if (text.length <= max) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const rawChunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim().length > 0) rawChunks.push(current.trimEnd());
    current = "";
  };

  const pushPiece = (piece: string) => {
    if (piece.length > max) {
      // Quebra por linha
      const lines = piece.split("\n");
      let buf = "";
      for (const line of lines) {
        if (line.length > max) {
          // Quebra por palavra
          if (buf) { rawChunks.push(buf); buf = ""; }
          const words = line.split(" ");
          let lineBuf = "";
          for (const w of words) {
            if (w.length > max) {
              // último recurso: corte cru
              if (lineBuf) { rawChunks.push(lineBuf); lineBuf = ""; }
              for (let i = 0; i < w.length; i += max) {
                rawChunks.push(w.slice(i, i + max));
              }
              continue;
            }
            const candidate = lineBuf ? `${lineBuf} ${w}` : w;
            if (candidate.length > max) {
              rawChunks.push(lineBuf);
              lineBuf = w;
            } else {
              lineBuf = candidate;
            }
          }
          if (lineBuf) buf = lineBuf;
          continue;
        }
        const candidate = buf ? `${buf}\n${line}` : line;
        if (candidate.length > max) {
          rawChunks.push(buf);
          buf = line;
        } else {
          buf = candidate;
        }
      }
      if (buf) rawChunks.push(buf);
    } else {
      rawChunks.push(piece);
    }
  };

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > max) {
      flush();
      pushPiece(para);
    } else {
      current = candidate;
    }
  }
  flush();

  // Repara blocos de código quebrados entre chunks
  const repaired: string[] = [];
  let openLang: string | null = null;
  for (const chunk of rawChunks) {
    let body = chunk;
    if (openLang !== null) body = `\`\`\`${openLang}\n${body}`;

    // Conta cercas no chunk final (já com possível reabertura)
    const fences = body.match(/```/g) ?? [];
    if (fences.length % 2 === 1) {
      // Se o bloco abriu mas não fechou, descobre a linguagem desta abertura para reusar
      const lastOpen = body.lastIndexOf("```");
      const tail = body.slice(lastOpen + 3);
      const langMatch = tail.match(/^([A-Za-z0-9_+\-]*)/);
      openLang = langMatch ? langMatch[1] : "";
      body = `${body}\n\`\`\``;
    } else {
      openLang = null;
    }
    repaired.push(body);
  }

  return repaired;
}

/**
 * Envia uma resposta longa em vários `channel.send`/`reply` respeitando o limite do Discord.
 * O primeiro envio usa `firstSender` (geralmente `message.reply`) e os seguintes vão como
 * `channel.send` em sequência, com um pequeno indicador `(parte N/M)` quando houver mais de um.
 */
export async function sendChunkedReply(
  message: import("discord.js").Message,
  text: string,
  options: { useReply?: boolean; max?: number; label?: boolean } = {}
): Promise<void> {
  const { useReply = false, max = 1900, label = true } = options;
  const chunks = chunkForDiscord(text, max);
  if (chunks.length === 0) return;

  for (let i = 0; i < chunks.length; i++) {
    const isFirst = i === 0;
    const tag = label && chunks.length > 1 ? `\n*(parte ${i + 1}/${chunks.length})*` : "";
    const body = chunks[i] + tag;
    if (isFirst && useReply) {
      await message.reply(body).catch(() => message.channel.send(body).catch(() => {}));
    } else {
      await message.channel.send(body).catch(() => {});
    }
  }
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
