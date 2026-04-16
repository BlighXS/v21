import type { GuildMember } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { safeFetch } from "../utils/net.js";
import { config } from "../utils/config.js";
import { isAdminMember } from "../utils/permissions.js";
import { logger } from "../utils/logger.js";
import { buildEmbed, buildEmbedFields, truncate, formatUptime, formatBytes } from "../utils/format.js";
import { handleTrainerCommand } from "../training/trainer.js";
import { buildTrainingPrompt } from "../training/store.js";
import { handleServerSetupCommand } from "../setup/serverSetup.js";
import { handleBackupCommand } from "../backup/backup.js";
import { searchTracks } from "../music/spotify.js";

function canRestart(member: GuildMember): boolean {
  if (config.RESTART_ROLE_IDS.length === 0) return isAdminMember(member);
  return member.roles.cache.some((role) => config.RESTART_ROLE_IDS.includes(role.id));
}

async function queryFwp(query: string): Promise<string> {
  const { Ollama } = await import("ollama");
  const ollama = new Ollama({ host: config.OLLAMA_HOST });

  const response = await ollama.chat({
    model: config.OLLAMA_MODEL,
    messages: [
      {
        role: "system",
        content: "Voc\u00ea \u00e9 o Fawer\u2019Bot, assistente do servidor Fawer Blight. Responda sempre em PT-BR de forma \u00fatil, direta e alinhada ao servidor."
      },
      { role: "user", content: query }
    ]
  });

  return response.message?.content?.trim() || "Sem resposta gerada.";
}

const event: BotEvent = {
  name: "messageCreate",
  async execute(message) {
    if (!config.ENABLE_PREFIX) return;
    if (!message.guild) return;
    if (message.author.bot) return;

    const prefix = config.PREFIX;
    if (!message.content.startsWith(prefix)) return;

    const content = message.content.slice(prefix.length).trim();
    if (!content) return;

    const parts = content.split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    if (!command) return;

    if (command === "ping") {
      const start = Date.now();
      const temp = await message.reply("Verificando...");
      const roundtrip = Date.now() - start;
      const ws = message.client.ws.ping;
      const fields = [
        { name: "\u{1F4E1} WebSocket", value: `${ws >= 0 ? ws : "..."}ms`, inline: true },
        { name: "\u23F1\uFE0F Roundtrip", value: `${roundtrip}ms`, inline: true }
      ];
      const embed = buildEmbedFields("Pong!", fields, "ok");
      await temp.edit({ content: "", embeds: [embed] });
      return;
    }

    if (command === "ajuda") {
      const fields = [
        {
          name: "\u2022 Gerais",
          value: [
            `\`${prefix}ping\` \u2014 Lat\u00eancia`,
            `\`${prefix}info\` \u2014 Info do servidor`,
            `\`${prefix}usuario [@alvo]\` \u2014 Perfil de usu\u00e1rio`,
            `\`${prefix}ajuda\` \u2014 Esta mensagem`
          ].join("\n"),
          inline: true
        },
        {
          name: "\u2022 M\u00fasica & IA",
          value: [
            `\`${prefix}spf <pesquisa>\` \u2014 Busca Spotify`,
            `\`${prefix}fwp <pergunta>\` \u2014 Consulta IA Fawer`,
            `\`${prefix}trainer\` \u2014 Treinar a IA`
          ].join("\n"),
          inline: true
        },
        {
          name: "\u2022 Backup",
          value: [
            `\`${prefix}backup server <nome>\``,
            `\`${prefix}backup list\``,
            `\`${prefix}backup restore\``
          ].join("\n"),
          inline: true
        },
        {
          name: "\u2022 Admin",
          value: [
            `\`${prefix}admin status\` \u2014 Status do bot`,
            `\`${prefix}restart\` \u2014 Reiniciar`,
            `\`${prefix}svrc\` \u2014 Setup do servidor`,
            `\`${prefix}net fetch <url>\` \u2014 HTTP seguro`
          ].join("\n"),
          inline: true
        }
      ];
      const embed = buildEmbedFields(
        "Fawer\u2019Bot \u2014 Ajuda",
        fields,
        "info",
        `Prefixo: \`${prefix}\` \u2022 Use tamb\u00e9m os comandos barra \`/\``
      );
      await message.reply({ embeds: [embed] });
      return;
    }

    if (command === "info") {
      const guild = message.guild;
      const channels = guild.channels.cache;
      const textCount = channels.filter((c) => c.isTextBased()).size;
      const voiceCount = channels.filter((c) => c.type === 2).size;
      const roles = guild.roles.cache.size - 1;
      const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`;
      const fields = [
        { name: "\u{1F194} ID", value: guild.id, inline: true },
        { name: "\u{1F465} Membros", value: `${guild.memberCount}`, inline: true },
        { name: "\u{1F4C5} Criado em", value: createdAt, inline: true },
        {
          name: "\u{1F4AC} Canais",
          value: `Texto: ${textCount} | Voz: ${voiceCount}`,
          inline: true
        },
        { name: "\u{1F3AD} Cargos", value: `${roles}`, inline: true },
        {
          name: "\u{1F4E3} Boost",
          value: `N\u00edvel ${guild.premiumTier}`,
          inline: true
        }
      ];
      const embed = buildEmbedFields(`Informa\u00e7\u00f5es \u2014 ${guild.name}`, fields, "info");
      await message.reply({ embeds: [embed] });
      return;
    }

    if (command === "usuario") {
      const mention = message.mentions.users.first() ?? message.author;
      const member = message.guild.members.cache.get(mention.id);
      const createdAt = `<t:${Math.floor(mention.createdTimestamp / 1000)}:D>`;
      const joinedAt = member?.joinedTimestamp
        ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`
        : "Desconhecido";
      const roles = member
        ? member.roles.cache
            .filter((r) => r.name !== "@everyone")
            .sort((a, b) => b.position - a.position)
            .map((r) => `<@&${r.id}>`)
            .slice(0, 8)
            .join(", ") || "Nenhum"
        : "N/A";
      const fields = [
        { name: "\u{1F194} ID", value: mention.id, inline: true },
        { name: "\u{1F4C5} Conta criada", value: createdAt, inline: true },
        { name: "\u{1F4C5} Entrou", value: joinedAt, inline: true },
        { name: "\u{1F4CB} Cargos", value: roles, inline: false }
      ];
      const embed = buildEmbedFields(`Usu\u00e1rio \u2014 ${mention.tag}`, fields, "action");
      await message.reply({ embeds: [embed] });
      return;
    }

    if (command === "admin") {
      const sub = parts.shift()?.toLowerCase();
      if (sub !== "status" && sub !== "restart") return;
      if (!message.member || !isAdminMember(message.member)) {
        const embed = buildEmbed("Acesso negado", "Sem permiss\u00e3o para este comando.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }

      if (sub === "status") {
        const mem = process.memoryUsage();
        const uptime = formatUptime(process.uptime());
        const guilds = message.client.guilds.cache.size;
        const fields = [
          {
            name: "\u{1F4CA} Bot",
            value: [
              `Uptime: **${uptime}**`,
              `Servidores: **${guilds}**`,
              `Node.js: **${process.version}**`
            ].join("\n"),
            inline: true
          },
          {
            name: "\u{1F4BB} Mem\u00f3ria",
            value: [
              `RSS: **${formatBytes(mem.rss)}**`,
              `Heap: **${formatBytes(mem.heapUsed)}**`
            ].join("\n"),
            inline: true
          },
          {
            name: "\u2699\uFE0F Config",
            value: [
              `Prefixo: \`${config.PREFIX}\``,
              `Canal log: ${config.LOG_CHANNEL_ID ? "\u2705" : "\u274C"}`,
              `Dashboard: ${config.DASHBOARD_TOKEN ? "\u2705" : "\u274C"}`,
              `Spotify: ${config.SPOTIFY_CLIENT_ID ? "\u2705" : "\u274C"}`
            ].join("\n"),
            inline: false
          }
        ];
        const embed = buildEmbedFields("Status do Bot", fields, "info");
        const temp = await message.reply("Coletando dados...");
        await temp.edit({ content: "", embeds: [embed] });
        return;
      }

      if (sub === "restart") {
        if (!canRestart(message.member)) {
          const embed = buildEmbed("Acesso negado", "Sem permiss\u00e3o para reiniciar.", "warn");
          await message.reply({ embeds: [embed] });
          return;
        }
        const embed = buildEmbed("Reiniciando", "O bot ser\u00e1 reiniciado em instantes...", "warn");
        await message.reply({ embeds: [embed] });
        const { restartProcess } = await import("../utils/restart.js");
        setTimeout(() => restartProcess(), 500);
        return;
      }
    }

    if (command === "restart") {
      if (!message.member || !canRestart(message.member)) {
        const embed = buildEmbed("Acesso negado", "Sem permiss\u00e3o para reiniciar.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }
      const embed = buildEmbed("Reiniciando", "O bot ser\u00e1 reiniciado em instantes...", "warn");
      await message.reply({ embeds: [embed] });
      const { restartProcess } = await import("../utils/restart.js");
      setTimeout(() => restartProcess(), 500);
      return;
    }

    if (command === "trainer") {
      await handleTrainerCommand(message, parts);
      return;
    }

    if (command === "svrc") {
      await handleServerSetupCommand(message);
      return;
    }

    if (command === "backup") {
      await handleBackupCommand(message, parts);
      return;
    }

    if (command === "spf") {
      const query = parts.join(" ");
      if (!query.trim()) {
        const embed = buildEmbed("Uso correto", `Uso: \`${prefix}spf <m\u00fasica ou artista>\``, "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      const temp = await message.reply("Buscando no Spotify...");
      try {
        const tracks = await searchTracks(query, 5);
        if (tracks.length === 0) {
          const embed = buildEmbed("Spotify", "Nenhum resultado encontrado para essa pesquisa.", "info");
          await temp.edit({ content: "", embeds: [embed] });
          return;
        }

        const lines = tracks.map((track, index) => {
          const min = Math.floor(track.durationMs / 60000);
          const sec = Math.floor((track.durationMs % 60000) / 1000).toString().padStart(2, "0");
          return `${index + 1}. **[${track.name}](${track.externalUrl})** \u2014 ${track.artists} (${min}:${sec})`;
        });
        const fields = [{ name: `Resultados para "${query}"`, value: lines.join("\n"), inline: false }];
        const embed = buildEmbedFields("Spotify", fields, "action");
        await temp.edit({ content: "", embeds: [embed] });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha no Spotify", msg, "error");
        await temp.edit({ content: "", embeds: [embed] });
      }
      return;
    }

    if (command === "fwp") {
      const query = parts.join(" ");
      if (!query.trim()) {
        const embed = buildEmbed("Uso correto", `Uso: \`${prefix}fwp <pergunta>\``, "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      const temp = await message.reply("\u{1F9E0} Consultando a Fawer IA...");
      const start = Date.now();

      try {
        const prompt = await buildTrainingPrompt(query);
        const response = await queryFwp(prompt);
        const trimmed = truncate(response, 1900);
        const embed = buildEmbed("Fawer IA", trimmed, "action");
        await temp.edit({ content: "", embeds: [embed] });
        logger.info({
          type: "prefix",
          command: "fwp",
          durationMs: Date.now() - start
        }, "Fwp executado");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha \u2014 Fawer IA", msg, "error");
        await temp.edit({ content: "", embeds: [embed] });
        logger.error({ error, command: "fwp" }, "Fwp falhou");
      }
      return;
    }

    if (command === "net") {
      const sub = parts.shift()?.toLowerCase();
      if (sub !== "fetch") return;
      if (!message.member || !isAdminMember(message.member)) {
        const embed = buildEmbed("Acesso negado", "Sem permiss\u00e3o para este comando.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }

      const url = parts.shift();
      if (!url) {
        const embed = buildEmbed("Uso correto", `Uso: \`${prefix}net fetch <url>\``, "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      const temp = await message.reply("Fazendo requisi\u00e7\u00e3o...");
      try {
        const result = await safeFetch(url);
        const trimmed = truncate(result, 3000);
        const embed = buildEmbed("Net Fetch", `Resposta:\n\n${trimmed}`, "action");
        await temp.edit({ content: "", embeds: [embed] });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha", messageText, "error");
        await temp.edit({ content: "", embeds: [embed] });
      }
      return;
    }

    logger.info({ command }, "Comando de prefixo desconhecido");
  }
};

export default event;
