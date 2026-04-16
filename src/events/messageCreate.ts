import type { GuildMember } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { safeFetch } from "../utils/net.js";
import { config } from "../utils/config.js";
import { isAdminMember } from "../utils/permissions.js";
import { logger } from "../utils/logger.js";
import { buildEmbed, truncate } from "../utils/format.js";
import { handleTrainerCommand } from "../training/trainer.js";
import { buildTrainingPrompt } from "../training/store.js";
import { handleServerSetupCommand } from "../setup/serverSetup.js";
import { handleBackupCommand } from "../backup/backup.js";
import { searchTracks } from "../music/spotify.js";

function canRestart(member: GuildMember): boolean {
  if (config.RESTART_ROLE_IDS.length === 0) return isAdminMember(member);
  return member.roles.cache.some((role) => config.RESTART_ROLE_IDS.includes(role.id));
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
      const temp = await message.reply("Processando...");
      const embed = buildEmbed("Status", "Pong.", "ok");
      await temp.edit({ content: "", embeds: [embed] });
      logger.info({
        type: "prefix",
        command: "ping",
        userId: message.author.id,
        channelId: message.channel.id,
        guildId: message.guild.id,
        durationMs: Date.now() - start
      }, "Command executed");
      return;
    }

    if (command === "admin") {
      const sub = parts.shift()?.toLowerCase();
      if (sub !== "status" && sub !== "restart") return;
      if (!message.member || !isAdminMember(message.member)) {
        const embed = buildEmbed("Acesso negado", "Sem permissao para este comando.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }

      if (sub === "status") {
        const content = [
          `Guild: ${message.guild.name}`,
          `Admin roles: ${config.ADMIN_ROLE_IDS.length}`,
          `Restart roles: ${config.RESTART_ROLE_IDS.length}`,
          `Log channel: ${config.LOG_CHANNEL_ID ? "configurado" : "nao"}`,
          `Dashboard: ${config.DASHBOARD_TOKEN ? "ativo" : "inativo"}`,
          `Prefixo: ${config.PREFIX}`
        ].join("\n");

        const start = Date.now();
        const temp = await message.reply("Processando...");
        const embed = buildEmbed("Status", content, "info");
        await temp.edit({ content: "", embeds: [embed] });
        logger.info({
          type: "prefix",
          command: "admin status",
          userId: message.author.id,
          channelId: message.channel.id,
          guildId: message.guild.id,
          durationMs: Date.now() - start
        }, "Command executed");
        return;
      }

      if (sub === "restart") {
        if (!canRestart(message.member)) {
          const embed = buildEmbed("Acesso negado", "Sem permissao para este comando.", "warn");
          await message.reply({ embeds: [embed] });
          return;
        }

        const embed = buildEmbed("Reinicio", "Reiniciando processo...", "warn");
        await message.reply({ embeds: [embed] });
        const { restartProcess } = await import("../utils/restart.js");
        restartProcess();
        return;
      }
    }

    if (command === "restart") {
      if (!message.member || !canRestart(message.member)) {
        const embed = buildEmbed("Acesso negado", "Sem permissao para este comando.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }
      const embed = buildEmbed("Reinicio", "Reiniciando processo...", "warn");
      await message.reply({ embeds: [embed] });
      const { restartProcess } = await import("../utils/restart.js");
      restartProcess();
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
        const embed = buildEmbed("Uso correto", "Uso: `;spf <musica ou artista>`", "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      try {
        const tracks = await searchTracks(query, 5);
        if (tracks.length === 0) {
          const embed = buildEmbed("Spotify", "Nenhum resultado encontrado.", "info");
          await message.reply({ embeds: [embed] });
          return;
        }

        const lines = tracks.map((track, index) => {
          const duration = Math.round(track.durationMs / 1000);
          return `${index + 1}. [${track.name}](${track.externalUrl}) — ${track.artists} (${duration}s)`;
        });
        const embed = buildEmbed("Spotify", lines.join("\n"), "action");
        await message.reply({ embeds: [embed] });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha Spotify", msg, "error");
        await message.reply({ embeds: [embed] });
      }
      return;
    }

    if (command === "fwp") {
      const query = parts.join(" ");
      if (!query.trim()) {
        const embed = buildEmbed("Uso correto", "Uso: `;fwp <pergunta>`", "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      const temp = await message.reply("Consultando Fawer IA...");
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
          query: query.length > 50 ? query.substring(0, 50) + "..." : query,
          userId: message.author.id,
          channelId: message.channel.id,
          guildId: message.guild.id,
          durationMs: Date.now() - start
        }, "Fwp executed");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha Fawer IA", msg, "error");
        await temp.edit({ content: "", embeds: [embed] });
        logger.error({ error, command: "fwp" }, "Fwp failed");
      }
      return;
    }

    if (command === "net") {
      const sub = parts.shift()?.toLowerCase();
      if (sub !== "fetch") return;
      if (!message.member || !isAdminMember(message.member)) {
        const embed = buildEmbed("Acesso negado", "Sem permissao para este comando.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }

      const url = parts.shift();
      if (!url) {
        const embed = buildEmbed("Uso correto", "Uso: `;net fetch <url>`", "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      try {
        const start = Date.now();
        const temp = await message.reply("Processando...");
        const result = await safeFetch(url);
        const trimmed = truncate(result, 3000);
        const embed = buildEmbed("Net Fetch", `Resposta:\n\n${trimmed}`, "action");
        await temp.edit({ content: "", embeds: [embed] });
        logger.info({
          type: "prefix",
          command: "net fetch",
          userId: message.author.id,
          channelId: message.channel.id,
          guildId: message.guild.id,
          durationMs: Date.now() - start
        }, "Command executed");
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha", messageText, "error");
        await message.reply({ embeds: [embed] });
      }
      return;
    }

    logger.info({ command }, "Unknown prefix command");
  }
};

async function queryFwp(query: string): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey || !baseURL) {
    throw new Error("IA nao configurada no ambiente.");
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey, baseURL });
  const completion = await openai.chat.completions.create({
    model: config.OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: "Voce responde como o Fawer'Bot em PT-BR. Seja util, direto, seguro e alinhado ao treinamento do servidor."
      },
      {
        role: "user",
        content: query
      }
    ],
    max_completion_tokens: 8192
  });

  return completion.choices[0]?.message?.content?.trim() || "Sem resposta gerada.";
}

export default event;
