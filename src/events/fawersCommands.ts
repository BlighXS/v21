import {
  Message,
  PermissionsBitField,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import type { BotEvent } from "../utils/events.js";
import {
  isPEFile,
  downloadAndParsePE,
  formatPEReport,
  buildStringsAttachment,
} from "../ai/binaryAnalysis.js";
import crypto from "node:crypto";
import { logger } from "../utils/logger.js";

const OWNER_ID = "892469618063589387";
const LOCK_ROLE_ID = "1493095650555068576";

const MAX_INPUT = 2000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10mb

const cooldown = new Map<string, number>();
const COOLDOWN_MS = 1500;

function isOnCooldown(id: string) {
  const last = cooldown.get(id);
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

function setCooldown(id: string) {
  cooldown.set(id, Date.now());
  setTimeout(() => cooldown.delete(id), COOLDOWN_MS * 2);
}

const event: BotEvent = {
  name: "messageCreate",
  execute: async (message: Message) => {
    try {
      if (message.author.bot) return;

      const content = message.content?.trim();
      if (!content) return;

      const userId = message.author.id;

      if (isOnCooldown(userId)) return;
      setCooldown(userId);

      const args = content.split(/\s+/);
      const command = args[0]?.toLowerCase();

      // =========================
      // !analyze
      // =========================
      if (command === "!analyze") {
        const attachments = [...message.attachments.values()];
        const peFile = attachments.find((a) => isPEFile(a.name ?? ""));

        if (!peFile) {
          await message.reply("Envie um executável válido.");
          return;
        }

        if ((peFile.size ?? 0) > MAX_FILE_SIZE) {
          await message.reply("Arquivo muito grande.");
          return;
        }

        const temp = await message.reply("Analisando...");

        try {
          const report = await Promise.race([
            downloadAndParsePE(peFile.url),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 20_000),
            ),
          ]);

          const fname = peFile.name ?? "binario";
          const summary = formatPEReport(report, fname);

          const files: AttachmentBuilder[] = [];

          if (report.strings?.length) {
            files.push(
              new AttachmentBuilder(
                Buffer.from(buildStringsAttachment(report), "utf8"),
                { name: `${fname}_strings.txt` },
              ),
            );
          }

          await temp.edit({
            content: summary.slice(0, 2000),
            files,
          });
        } catch (error) {
          logger.warn({ error }, "Erro analyze");
          await temp.edit("Erro na análise.");
        }

        return;
      }

      // =========================
      // !whois
      // =========================
      if (command === "!whois") {
        const target = args[1]?.slice(0, 100);
        if (!target) {
          await message.reply("Uso: !whois <ip/domínio>");
          return;
        }

        const temp = await message.reply("Consultando...");

        try {
          const res = await fetch(
            `http://ip-api.com/json/${target}?fields=status,message,country,city,isp,query`,
            {
              signal: AbortSignal.timeout(8000),
            },
          );

          const data = (await res.json()) as any;

          if (data.status !== "success") {
            await temp.edit("Falha.");
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle(`Whois — ${data.query}`)
            .setColor(0x0099ff)
            .addFields(
              {
                name: "Local",
                value: `${data.city}, ${data.country}`,
                inline: true,
              },
              { name: "ISP", value: data.isp || "N/A", inline: true },
            );

          await temp.edit({ content: "", embeds: [embed] });
        } catch (error) {
          logger.warn({ error }, "Erro whois");
          await temp.edit("Erro na consulta.");
        }

        return;
      }

      // =========================
      // !toolkit
      // =========================
      if (command === "!toolkit") {
        const op = args[1]?.toLowerCase();
        const input = args.slice(2).join(" ").slice(0, MAX_INPUT);

        if (!op || !input) {
          await message.reply("Uso: !toolkit <op> <valor>");
          return;
        }

        let result = "";

        try {
          switch (op) {
            case "b64enc":
              result = Buffer.from(input).toString("base64");
              break;
            case "b64dec":
              result = Buffer.from(input, "base64").toString("utf-8");
              break;
            case "hexenc":
              result = Buffer.from(input).toString("hex");
              break;
            case "hexdec":
              result = Buffer.from(input, "hex").toString("utf-8");
              break;
            case "urlenc":
              result = encodeURIComponent(input);
              break;
            case "urldec":
              result = decodeURIComponent(input);
              break;
            case "md5":
              result = crypto.createHash("md5").update(input).digest("hex");
              break;
            case "sha1":
              result = crypto.createHash("sha1").update(input).digest("hex");
              break;
            case "sha256":
              result = crypto.createHash("sha256").update(input).digest("hex");
              break;
            default:
              result = "Operação inválida";
          }

          if (result.length > 1800) {
            const att = new AttachmentBuilder(Buffer.from(result), {
              name: "result.txt",
            });
            await message.reply({ files: [att] });
          } else {
            await message.reply(`\`\`\`\n${result}\n\`\`\``);
          }
        } catch (error) {
          logger.warn({ error }, "Erro toolkit");
          await message.reply("Erro.");
        }

        return;
      }

      // =========================
      // !bomb
      // =========================
      if (command === "!bomb") {
        await message.reply("Boom 💣");
        return;
      }

      // =========================
      // OWNER ONLY
      // =========================
      if (userId === OWNER_ID) {
        if (command === "!lock" || command === "!unlock") {
          try {
            const channel = message.channel as any;

            if (!channel.permissionOverwrites) return;

            const perms =
              command === "!lock"
                ? { SendMessages: false }
                : { SendMessages: null };

            await channel.permissionOverwrites.edit(LOCK_ROLE_ID, perms);

            await message.reply(command === "!lock" ? "🔒" : "🔓");
          } catch (error) {
            logger.error({ error }, "Erro lock/unlock");
          }

          return;
        }

        if (command === "!say" || command === "!dm") {
          const targetId = args[1];
          const text = args.slice(2).join(" ").slice(0, MAX_INPUT);

          if (!targetId || !text) return;

          try {
            if (command === "!say") {
              const ch = await message.client.channels.fetch(targetId);
              if (ch && "send" in ch) {
                await (ch as any).send(text);
              }
            }

            if (command === "!dm") {
              const user = await message.client.users.fetch(targetId);
              await user.send(text);
            }

            await message.react("✅");
          } catch (error) {
            logger.warn({ error }, "Erro owner command");
          }

          return;
        }
      }
    } catch (error) {
      logger.error({ error }, "Erro geral messageCreate");
    }
  },
};

export default event;
