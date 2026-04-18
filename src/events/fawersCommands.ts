import { Message, PermissionsBitField, AttachmentBuilder, EmbedBuilder } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { isPEFile, downloadAndParsePE, formatPEReport, buildStringsAttachment } from "../ai/binaryAnalysis.js";
import crypto from "node:crypto";

const OWNER_ID = "892469618063589387";
const LOCK_ROLE_ID = "1493095650555068576";

const event: BotEvent = {
  name: "messageCreate",
  execute: async (message: Message) => {
    if (message.author.bot) return;

    const content = message.content.trim();
    const args = content.split(/\s+/);
    const command = args[0]?.toLowerCase();

    // !analyze - Analisador de Binários PE
    if (command === "!analyze") {
      const attachments = [...message.attachments.values()];
      const peFile = attachments.find((a) => isPEFile(a.name ?? ""));

      if (!peFile) {
        await message.reply("🔬 **Analisador de Binários PE**\nPara usar, envie o comando `!analyze` junto com um arquivo executável (exe, dll, sys, etc).");
        return;
      }

      const temp = await message.reply("🔬 **Iniciando análise estática...**");

      try {
        const report = await downloadAndParsePE(peFile.url);
        const fname = peFile.name ?? "binario";
        const summary = formatPEReport(report, fname);
        const stringsContent = buildStringsAttachment(report);

        const files: AttachmentBuilder[] = [];
        if (report.strings.length > 0) {
          files.push(new AttachmentBuilder(Buffer.from(stringsContent, "utf8"), { name: `${fname}_strings.txt` }));
        }

        await temp.edit({ content: summary.slice(0, 2000), files });
      } catch (err) {
        await temp.edit("❌ Ocorreu um erro ao processar o binário.");
      }
      return;
    }

    // !whois <ip/dominio>
    if (command === "!whois") {
      const target = args[1];
      if (!target) {
        await message.reply("🌐 **Uso:** `!whois <ip ou domínio>`");
        return;
      }

      const temp = await message.reply(`🌐 **Consultando informações para:** \`${target}\`...`);

      try {
        const { default: fetch } = await import("node-fetch");
        const res = await fetch(`http://ip-api.com/json/${target}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
        const data = await res.json() as any;

        if (data.status === "fail") {
          await temp.edit(`❌ Falha na consulta: ${data.message || "alvo inválido"}`);
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`🌐 Whois Report — ${data.query}`)
          .setColor(0x0099ff)
          .addFields(
            { name: "📍 Localização", value: `${data.city}, ${data.regionName}, ${data.country} (\`${data.countryCode}\`)`, inline: true },
            { name: "🕒 Timezone", value: data.timezone, inline: true },
            { name: "📡 Provedor (ISP)", value: data.isp, inline: false },
            { name: "🏢 Organização", value: data.org || "N/A", inline: true },
            { name: "🆔 AS (ASN)", value: data.as, inline: true },
            { name: "🗺️ Coordenadas", value: `Lat: ${data.lat} | Lon: ${data.lon}`, inline: false }
          )
          .setFooter({ text: "Powered by IP-API" });

        await temp.edit({ content: "", embeds: [embed] });
      } catch (err) {
        await temp.edit("❌ Erro ao realizar consulta de rede.");
      }
      return;
    }

    // !toolkit <op> <input> - Conversor Técnico
    if (command === "!toolkit") {
      const op = args[1]?.toLowerCase();
      const input = args.slice(2).join(" ");

      if (!op || !input) {
        const helpEmbed = new EmbedBuilder()
          .setTitle("🛠️ Fawers Toolkit — Ajuda")
          .setColor(0xffaa00)
          .setDescription("**Uso:** `!toolkit <operação> <texto/valor>`")
          .addFields(
            { name: "📦 Encoders/Decoders", value: "`b64enc`, `b64dec`, `hexenc`, `hexdec`, `urlenc`, `urldec`", inline: false },
            { name: "🔒 Hashing", value: "`md5`, `sha1`, `sha256`", inline: false },
            { name: "🔢 Bases", value: "`dec2hex`, `hex2dec`, `dec2bin`, `bin2dec`", inline: false }
          );
        await message.reply({ embeds: [helpEmbed] });
        return;
      }

      let result = "";
      try {
        switch (op) {
          case "b64enc": result = Buffer.from(input).toString("base64"); break;
          case "b64dec": result = Buffer.from(input, "base64").toString("utf-8"); break;
          case "hexenc": result = Buffer.from(input).toString("hex"); break;
          case "hexdec": result = Buffer.from(input, "hex").toString("utf-8"); break;
          case "urlenc": result = encodeURIComponent(input); break;
          case "urldec": result = decodeURIComponent(input); break;
          case "md5": result = crypto.createHash("md5").update(input).digest("hex"); break;
          case "sha1": result = crypto.createHash("sha1").update(input).digest("hex"); break;
          case "sha256": result = crypto.createHash("sha256").update(input).digest("hex"); break;
          case "dec2hex": result = Number(input).toString(16).toUpperCase(); break;
          case "hex2dec": result = parseInt(input, 16).toString(); break;
          case "dec2bin": result = Number(input).toString(2); break;
          case "bin2dec": result = parseInt(input, 2).toString(); break;
          default: result = "❌ Operação desconhecida.";
        }

        if (result.length > 1950) {
          const att = new AttachmentBuilder(Buffer.from(result, "utf8"), { name: "result.txt" });
          await message.reply({ content: "✅ Resultado muito grande, enviado como arquivo:", files: [att] });
        } else {
          await message.reply(`💻 **Resultado:**\n\`\`\`\n${result}\n\`\`\``);
        }
      } catch (e) {
        await message.reply("❌ Erro ao processar conversão. Verifique o formato do input.");
      }
      return;
    }

    // Comando !bomb
    if (command === "!bomb") {
      await message.reply("Boom! 💣");
      return;
    }

    // Comandos restritos ao Criador
    if (message.author.id === OWNER_ID) {
      if (command === "!lock") {
        try {
          const channel = message.channel as any;
          if (channel.permissionOverwrites) {
            await channel.permissionOverwrites.edit(LOCK_ROLE_ID, { SendMessages: false, ViewChannel: true });
            await message.reply("🔒 Canal trancado!");
          }
        } catch (e) { await message.reply("❌ Erro ao trancar."); }
        return;
      }

      if (command === "!unlock") {
        try {
          const channel = message.channel as any;
          if (channel.permissionOverwrites) {
            await channel.permissionOverwrites.edit(LOCK_ROLE_ID, { SendMessages: null, ViewChannel: null });
            await message.reply("🔓 Canal destrancado!");
          }
        } catch (e) { await message.reply("❌ Erro ao destrancar."); }
        return;
      }

      if (command === "!say") {
        const targetId = args[1];
        const text = args.slice(2).join(" ");
        if (!targetId || !text) return;
        try {
          const target = await message.client.channels.fetch(targetId);
          if (target && "send" in target) {
            await (target as any).send(text);
            await message.react("✅");
          }
        } catch (e) {}
        return;
      }

      if (command === "!dm") {
        const targetId = args[1];
        const text = args.slice(2).join(" ");
        if (!targetId || !text) return;
        try {
          const target = await message.client.users.fetch(targetId);
          if (target) {
            await target.send(text);
            await message.react("📩");
          }
        } catch (e) {}
        return;
      }
    }
  }
};

export default event;