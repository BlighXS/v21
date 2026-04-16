import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { GuildMember } from "discord.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BotEvent } from "../utils/events.js";
import { safeFetch } from "../utils/net.js";
import { config } from "../utils/config.js";
import { isAdminMember } from "../utils/permissions.js";
import { logger } from "../utils/logger.js";
import { buildEmbed, buildEmbedFields, truncate, formatUptime, formatBytes } from "../utils/format.js";
import { handleTrainerCommand } from "../training/trainer.js";
import { loadTrainingData } from "../training/store.js";
import { handleServerSetupCommand } from "../setup/serverSetup.js";
import { handleBackupCommand } from "../backup/backup.js";
import { searchTracks } from "../music/spotify.js";
import { getMusicQueue, playYoutubeMusic, skipMusic, stopMusic } from "../music/player.js";
import { loadUserMemory, appendToUserMemory, clearUserMemory } from "../ai/memory.js";
import { extractCodeBlocks, hasCodeBlocks, createZip, readAttachmentText, isTextAttachment, isImageAttachment } from "../ai/fileOps.js";
import { downloadAndParsePE, formatPEReport, buildStringsAttachment, isPEFile } from "../ai/binaryAnalysis.js";
import { resolveProjectType, getProjectTemplate } from "../ai/projectTemplates.js";
import { enableFreeMode, disableFreeMode, isFreeModeActive, isFreeModeOwner, FREE_MODE_SYSTEM_SUFFIX } from "../ai/freeMode.js";
import { getProvider } from "../ai/providerConfig.js";
import { queryGemini, GEMINI_MODEL_V3 } from "../ai/gemini.js";
import { buildAutonomousSystemPrompt, buildMemberProfile, recordMemorialEvent, recordMessageEvent } from "../ai/memorial.js";
import { executeFwpActions, stripFwpActionBlocks } from "../ai/actions.js";

function canRestart(member: GuildMember): boolean {
  if (config.RESTART_ROLE_IDS.length === 0) return isAdminMember(member);
  return member.roles.cache.some((role) => config.RESTART_ROLE_IDS.includes(role.id));
}

const SPINNER_FRAMES = ["|", "/", "–", "\\", "|", "/", "–", "\\"];
const SPINNER_LABEL = "pensando";

async function runWithSpinner(
  replyTarget: import("discord.js").Message,
  task: (
    spinnerMsg: import("discord.js").Message,
    setStatusText: (text: string | null) => void
  ) => Promise<string>
): Promise<{ result: string; spinnerMsg: import("discord.js").Message }> {
  let frame = 0;
  let statusText: string | null = null;
  const spinnerMsg = await replyTarget.reply(`⚙️ ${SPINNER_FRAMES[0]} ${SPINNER_LABEL}...`);

  replyTarget.channel.sendTyping().catch(() => {});
  const typingInterval = setInterval(() => replyTarget.channel.sendTyping().catch(() => {}), 8000);

  const spinnerInterval = setInterval(async () => {
    frame = (frame + 1) % SPINNER_FRAMES.length;
    try { await spinnerMsg.edit(statusText ?? `⚙️ ${SPINNER_FRAMES[frame]} ${SPINNER_LABEL}...`); } catch {}
  }, 700);

  try {
    const result = await task(spinnerMsg, (text) => {
      statusText = text;
    });
    return { result, spinnerMsg };
  } finally {
    clearInterval(spinnerInterval);
    clearInterval(typingInterval);
  }
}

async function queryLocalOllama(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string
): Promise<string> {
  const { Ollama } = await import("ollama");
  const ollama = new Ollama({ host: config.OLLAMA_HOST });

  const history = await loadUserMemory(memoryKey);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userQuery }
  ];

  const response = await ollama.chat({
    model: config.OLLAMA_MODEL,
    messages,
    options: { num_ctx: 4096 }
  });

  const reply = response.message?.content?.trim() || "Sem resposta gerada.";
  await appendToUserMemory(memoryKey, userQuery, reply);
  await recordMemorialEvent({
    type: "ai_response",
    content: reply,
    metadata: { provider: "ollama", memoryKey, model: config.OLLAMA_MODEL }
  });
  return reply;
}

async function queryOllama(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string
): Promise<string> {
  const provider = await getProvider();
  if (provider === "gemini") {
    return await queryGemini(systemPrompt, memoryKey, userQuery);
  }
  if (provider === "gemini-v3") {
    return await queryGemini(systemPrompt, memoryKey, userQuery, GEMINI_MODEL_V3);
  }
  return queryLocalOllama(systemPrompt, memoryKey, userQuery);
}

async function queryFwp(
  systemPrompt: string,
  userId: string,
  userQuery: string
): Promise<string> {
  return queryOllama(systemPrompt, userId, userQuery);
}

function isFwpOverloadError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  return (
    lower.includes("503") ||
    lower.includes("unavailable") ||
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    lower.includes("rate limit")
  );
}

function sanitizeFwpError(msg: string): string {
  return msg
    .replace(/gemini[-\s]?\d*[\.\d]*/gi, "FAWER")
    .replace(/gemini/gi, "FAWER")
    .replace(/google[\s_-]?gen[\s_-]?ai/gi, "FAWER")
    .replace(/google/gi, "motor")
    .replace(/openai/gi, "motor")
    .replace(/anthropic/gi, "motor")
    .replace(/api[\s_-]?key/gi, "chave interna")
    .replace(/GEMINI_API_KEY[_\d]*/gi, "chave interna")
    .replace(/AI_INTEGRATIONS[_\w]*/gi, "integração interna");
}

function formatFwpError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (isFwpOverloadError(error)) {
    return "CPU cheia, modelo passando fome de memória RAM. Tenta de novo daqui a pouco que eu volto menos miserável.";
  }

  return sanitizeFwpError(raw) || "Erro desconhecido";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryOnceAfterOverload(
  task: () => Promise<string>,
  onRetry: () => Promise<void>
): Promise<string> {
  try {
    return await task();
  } catch (error) {
    if (!isFwpOverloadError(error)) throw error;
    await onRetry();
    return task();
  }
}

interface PendingFwpRequest {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  systemPrompt: string;
  memoryKey: string;
  query: string;
  attempts: number;
  nextRunAt: number;
  createdAt: string;
}

const PENDING_FWP_FILE = path.join(process.cwd(), "data", "memory", "pending_fwp_queue.json");
let pendingFwpQueue: PendingFwpRequest[] = [];
let pendingLoaded = false;
let pendingTimer: NodeJS.Timeout | null = null;

async function loadPendingFwpQueue(): Promise<void> {
  if (pendingLoaded) return;
  pendingLoaded = true;
  try {
    const raw = await readFile(PENDING_FWP_FILE, "utf8");
    pendingFwpQueue = JSON.parse(raw) as PendingFwpRequest[];
  } catch {
    pendingFwpQueue = [];
  }
}

async function savePendingFwpQueue(): Promise<void> {
  await mkdir(path.dirname(PENDING_FWP_FILE), { recursive: true });
  await writeFile(PENDING_FWP_FILE, JSON.stringify(pendingFwpQueue, null, 2), "utf8");
}

async function enqueuePendingFwp(message: import("discord.js").Message, systemPrompt: string, memoryKey: string, query: string): Promise<void> {
  await loadPendingFwpQueue();
  const item: PendingFwpRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    guildId: message.guildId ?? "",
    channelId: message.channelId,
    userId: message.author.id,
    systemPrompt,
    memoryKey,
    query,
    attempts: 0,
    nextRunAt: Date.now() + 60_000,
    createdAt: new Date().toISOString()
  };
  pendingFwpQueue.push(item);
  await savePendingFwpQueue();
  await recordMessageEvent("system", message, "Pergunta FWP enviada para fila de retry persistente.", { queueId: item.id });
}

function startPendingFwpWorker(client: import("discord.js").Client): void {
  if (pendingTimer) return;
  pendingTimer = setInterval(async () => {
    await loadPendingFwpQueue();
    const now = Date.now();
    const due = pendingFwpQueue.filter((item) => item.nextRunAt <= now).slice(0, 2);
    for (const item of due) {
      try {
        const channel = await client.channels.fetch(item.channelId).catch(() => null);
        if (!channel?.isTextBased() || !("send" in channel)) {
          pendingFwpQueue = pendingFwpQueue.filter((queued) => queued.id !== item.id);
          continue;
        }

        item.attempts++;
        const raw = await queryOllama(item.systemPrompt, item.memoryKey, item.query);
        const clean = stripFwpActionBlocks(raw);
        const embed = buildEmbed("Fawers — resposta atrasada", `<@${item.userId}> consegui cobrar a resposta que ficou devendo:\n\n${truncate(clean, 1700)}`, "action");
        await channel.send({ embeds: [embed] });
        pendingFwpQueue = pendingFwpQueue.filter((queued) => queued.id !== item.id);
        await recordMemorialEvent({ type: "ai_response", channelId: item.channelId, guildId: item.guildId, userId: item.userId, content: clean, metadata: { queued: true, queueId: item.id } });
      } catch (error) {
        item.nextRunAt = Date.now() + Math.min(10 * 60_000, 60_000 * Math.max(1, item.attempts + 1));
        if (item.attempts >= 5 || !isFwpOverloadError(error)) {
          pendingFwpQueue = pendingFwpQueue.filter((queued) => queued.id !== item.id);
        }
      }
    }
    await savePendingFwpQueue();
  }, 30_000);
  pendingTimer.unref();
}

// kept for compatibility — free mode still uses it
async function streamOllama(
  systemPrompt: string,
  memoryKey: string,
  userQuery: string,
  _onChunk: (partial: string) => void
): Promise<string> {
  return queryOllama(systemPrompt, memoryKey, userQuery);
}

async function handleFreeMode(message: import("discord.js").Message): Promise<boolean> {
  const inFreeMode = await isFreeModeActive(message.channelId);
  if (!inFreeMode) return false;

  const prefix = config.PREFIX;
  const content = message.content.trim();

  // Let prefix commands be handled normally (don't intercept them here)
  if (content.startsWith(prefix)) return false;

  try {
    const trainingData = await loadTrainingData();
    const basePrompt = trainingData.compiledIdentity || trainingData.baseIdentity;
    const systemPrompt = await buildAutonomousSystemPrompt(basePrompt + FREE_MODE_SYSTEM_SUFFIX, message);

    const author = message.author;
    const display = message.member?.displayName ?? author.username;
    const userQuery = `[${display} (<@${author.id}>)]: ${content || "(mensagem sem texto)"}`;

    const memoryKey = `channel_${message.channelId}`;

    await recordMessageEvent("order_received", message, content || "(mensagem sem texto)", { mode: "free" });

    const { result: rawReply, spinnerMsg } = await runWithSpinner(
      message,
      (_spinnerMsg, setStatusText) => retryOnceAfterOverload(
        () => queryOllama(systemPrompt, memoryKey, userQuery),
        async () => {
          setStatusText(`${formatFwpError(new Error("503 unavailable"))}\n\nVou tentar cobrar a resposta de novo em 10s...`);
          await wait(10_000);
          setStatusText(null);
        }
      )
    );

    const actionReports = await executeFwpActions(message, rawReply);
    const reply = stripFwpActionBlocks(rawReply);

    await spinnerMsg.delete().catch(() => {});

    if (reply.startsWith("[SILENT]")) {
      logger.info({ channel: message.channelId }, "Free mode: Fawers optou por silêncio");
      return true;
    }

    const finalReply = actionReports.length > 0 ? `${reply}\n\n${actionReports.join("\n")}` : reply;
    await message.channel.send(truncate(finalReply, 1900));
    logger.info({ channel: message.channelId, author: author.id }, "Free mode: resposta enviada");
  } catch (err) {
    logger.error({ err }, "Free mode: falha ao gerar resposta");
  }

  return true;
}

const event: BotEvent = {
  name: "messageCreate",
  async execute(message) {
    if (!config.ENABLE_PREFIX) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    startPendingFwpWorker(message.client);

    // Free mode: intercept non-command messages in unlocked channels
    const handledByFreeMode = await handleFreeMode(message);
    if (handledByFreeMode) return;

    const prefix = config.PREFIX;
    if (!message.content.startsWith(prefix)) return;

    const content = message.content.slice(prefix.length).trim();
    if (!content) return;

    const parts = content.split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    if (!command) return;

    await recordMessageEvent("command_received", message, content, { command, args: parts.join(" ") });

    if (command === "fw") {
      const sub = parts.shift()?.toLowerCase();
      if (sub !== "music") return;

      const action = parts[0]?.toLowerCase();
      if (action === "stop") {
        const stopped = stopMusic(message.guild.id);
        const embed = buildEmbed("FW Music", stopped ? "Pare tudo e saí da call." : "Não tinha nada tocando.", stopped ? "ok" : "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      if (action === "skip") {
        const skipped = skipMusic(message.guild.id);
        const embed = buildEmbed("FW Music", skipped ? "Pulei essa faixa." : "Não tinha música ativa para pular.", skipped ? "ok" : "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      if (action === "queue" || action === "fila") {
        const queue = getMusicQueue(message.guild.id);
        const body = queue.length > 0
          ? queue.slice(0, 10).map((track, index) => `${index + 1}. **${track.title}**`).join("\n")
          : "Fila vazia.";
        await message.reply({ embeds: [buildEmbed("FW Music — Fila", body, "info")] });
        return;
      }

      const query = parts.join(" ").trim();
      if (!query) {
        const fields = [
          { name: "Tocar", value: `\`${prefix}fw music <nome da música>\``, inline: false },
          { name: "Fila", value: `\`${prefix}fw music queue\``, inline: true },
          { name: "Pular", value: `\`${prefix}fw music skip\``, inline: true },
          { name: "Parar", value: `\`${prefix}fw music stop\``, inline: true }
        ];
        await message.reply({ embeds: [buildEmbedFields("FW Music — Uso", fields, "info")] });
        return;
      }

      const voice = message.member?.voice?.channel;
      if (!voice) {
        await message.reply({ embeds: [buildEmbed("FW Music", "Entra numa call primeiro pra eu saber onde tocar.", "warn")] });
        return;
      }

      const temp = await message.reply("Procurando no YouTube e preparando a call...");
      try {
        const result = await playYoutubeMusic(message.client, message.guild, voice, query, message.author.id, message.channelId);
        const embed = buildEmbed(
          "FW Music",
          [
            `Tocando/enfileirado: **[${result.title}](${result.url})**`,
            `Pedido por: <@${message.author.id}>`,
            result.position > 1 ? `Posição na fila: **${result.position}**` : "Entrando na call agora."
          ].join("\n"),
          "ok"
        );
        await temp.edit({ content: "", embeds: [embed] });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("FW Music falhou", `Não consegui tocar isso: ${msg}`, "error");
        await temp.edit({ content: "", embeds: [embed] });
        logger.error({ error, command: "fw music", query }, "Falha ao tocar música");
      }
      return;
    }

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
          name: "\u2022 Fawers",
          value: [
            `\`${prefix}fwp <msg>\` \u2014 Conversa com a Fawers`,
            `\`${prefix}fwp\` + anexo \u2014 Envia arquivo para a Fawers`,
            `\`${prefix}fwp limpar\` \u2014 Apaga mem\u00f3ria`,
            `\`${prefix}setup fwp\` \u2014 Selecionar vers\u00e3o da Fawers`,
            `\`${prefix}ufwp\` \u2014 Desbloqueia a Fawers no canal`,
            `\`${prefix}lfwp\` \u2014 Bloqueia a Fawers de volta`,
            `\`${prefix}fw music <nome>\` \u2014 Toca YouTube na call`,
            `\`${prefix}pe\` + .exe/.dll \u2014 An\u00e1lise de bin\u00e1rio PE`,
            `\`${prefix}projeto <tipo> [nome]\` \u2014 Gera projeto ZIP`,
            `\`${prefix}spf <pesquisa>\` \u2014 Busca Spotify`,
            `\`${prefix}trainer\` \u2014 Treinar a Fawers`
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

    if (command === "setup" && parts[0]?.toLowerCase() === "fwp") {
      if (!isFreeModeOwner(message.author.id)) {
        const embed = buildEmbed("Acesso negado", "Sem permissão para acessar o setup.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("fwp_model_beta")
          .setLabel("Modelo Beta")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("fwp_model_v2")
          .setLabel("FAWER_V2.01")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("fwp_model_v3")
          .setLabel("FAWER Flash V3.0")
          .setStyle(ButtonStyle.Success)
      );

      const embed = buildEmbed("Setup — Fawers", "Qual versão da Fawers você quer ativar?", "info");
      await message.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (command === "ufwp") {
      if (!isFreeModeOwner(message.author.id)) {
        const embed = buildEmbed("Acesso negado", "Apenas o dono pode ativar o modo livre.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }
      const already = await isFreeModeActive(message.channelId);
      if (already) {
        const embed = buildEmbed("Fawers — Modo Livre", "A IA já está desbloqueada neste canal.", "info");
        await message.reply({ embeds: [embed] });
        return;
      }
      await enableFreeMode(message.channelId);
      const embed = buildEmbed("Fawers — Modo Livre ativado", "A IA está desbloqueada neste canal. Ela vai interagir por conta própria.", "ok");
      await message.reply({ embeds: [embed] });
      const trainingData = await loadTrainingData();
      const systemPrompt = (trainingData.compiledIdentity || trainingData.baseIdentity) + FREE_MODE_SYSTEM_SUFFIX;
      const memoryKey = `channel_${message.channelId}`;
      (async () => {
        try {
          const intro = await queryOllama(systemPrompt, memoryKey, "Você acabou de ser liberada para falar livremente neste canal. Diga algo breve para marcar sua presença.");
          if (intro && !intro.startsWith("[SILENT]")) {
            await message.channel.send(truncate(intro, 1900));
          }
        } catch {
          // intro opcional, falha silenciosa
        }
      })();
      logger.info({ channel: message.channelId, by: message.author.id }, "Free mode ativado");
      return;
    }

    if (command === "lfwp") {
      if (!isFreeModeOwner(message.author.id)) {
        const embed = buildEmbed("Acesso negado", "Apenas o dono pode desativar o modo livre.", "warn");
        await message.reply({ embeds: [embed] });
        return;
      }
      const active = await isFreeModeActive(message.channelId);
      if (!active) {
        const embed = buildEmbed("Fawers — Modo Livre", "A IA já está no modo normal neste canal.", "info");
        await message.reply({ embeds: [embed] });
        return;
      }
      await disableFreeMode(message.channelId);
      const embed = buildEmbed("Fawers — Modo Normal restaurado", "A IA voltou ao modo normal. Use `;fwp` para falar com ela.", "ok");
      await message.reply({ embeds: [embed] });
      logger.info({ channel: message.channelId, by: message.author.id }, "Free mode desativado");
      return;
    }

    if (command === "pe") {
      const attachments = [...message.attachments.values()];
      const peFile = attachments.find((a) => isPEFile(a.name ?? ""));

      if (!peFile) {
        const fields = [
          { name: "Uso", value: `Envie \`${prefix}pe\` junto com um arquivo \`.exe\`, \`.dll\`, \`.sys\`, \`.drv\`, etc.`, inline: false },
          { name: "O que é extraído", value: "PE headers, arquitetura, seções, tabela de imports, strings ASCII", inline: false }
        ];
        const embed = buildEmbedFields("Análise de Binário PE", fields, "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      const temp = await message.reply("🔬 Analisando binário...");
      const start = Date.now();

      try {
        const report = await downloadAndParsePE(peFile.url);
        const fname = peFile.name ?? "binario";
        const summary = formatPEReport(report, fname);
        const stringsContent = buildStringsAttachment(report);

        const files: AttachmentBuilder[] = [];

        // Full report as text file
        const reportLines: string[] = [
          `=== Relatório PE — ${fname} ===`,
          `Tamanho: ${(report.fileInfo.size / 1024).toFixed(1)} KB | Tipo: ${report.fileInfo.type}`,
          ""
        ];

        if (report.peHeader) {
          reportLines.push("[COFF Header]");
          reportLines.push(`  Arquitetura : ${report.peHeader.machine}`);
          reportLines.push(`  Seções      : ${report.peHeader.sections}`);
          reportLines.push(`  Timestamp   : ${report.peHeader.timestamp}`);
          reportLines.push(`  Flags       : ${report.peHeader.characteristics.join(" | ")}`);
          reportLines.push("");
        }

        if (report.optionalHeader) {
          reportLines.push("[Optional Header]");
          reportLines.push(`  Formato     : ${report.optionalHeader.magic}`);
          reportLines.push(`  Subsistema  : ${report.optionalHeader.subsystem}`);
          reportLines.push(`  Image Base  : ${report.optionalHeader.imageBase}`);
          reportLines.push(`  Entry Point : ${report.optionalHeader.entryPoint}`);
          reportLines.push(`  Linker      : ${report.optionalHeader.linkerVersion}`);
          reportLines.push(`  Img Size    : ${report.optionalHeader.sizeOfImage}`);
          reportLines.push("");
        }

        if (report.sections.length > 0) {
          reportLines.push("[Seções]");
          for (const sec of report.sections) {
            reportLines.push(`  ${sec.name.padEnd(10)} VA=${sec.virtualAddress.padEnd(12)} raw=${sec.rawSize.padEnd(14)} [${sec.characteristics}]`);
          }
          reportLines.push("");
        }

        if (report.imports.length > 0) {
          reportLines.push("[Imports]");
          for (const imp of report.imports) {
            reportLines.push(`  ${imp.dll}`);
            for (const fn of imp.functions) {
              reportLines.push(`    - ${fn}`);
            }
          }
          reportLines.push("");
        }

        reportLines.push("[Strings]");
        reportLines.push(...report.strings.map(s => `  ${s}`));

        const fullReport = reportLines.join("\n");
        files.push(new AttachmentBuilder(Buffer.from(fullReport, "utf8"), { name: `${fname}_pe_report.txt` }));

        const trimmed = summary.length > 1900 ? summary.slice(0, 1900) + "\n..." : summary;
        const embed = buildEmbed("Fawers — Binário PE", trimmed, "action");

        await temp.edit({ content: "", embeds: [embed], files });
        logger.info({ command: "pe", file: fname, durationMs: Date.now() - start, valid: report.valid }, "Análise PE concluída");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha — Análise PE", msg, "error");
        await temp.edit({ content: "", embeds: [embed] });
        logger.error({ error, command: "pe" }, "Análise PE falhou");
      }
      return;
    }

    if (command === "fwp") {
      const sub = parts[0]?.toLowerCase();

      if (sub === "limpar") {
        await clearUserMemory(message.author.id);
        const embed = buildEmbed("Fawers", "Memória de conversa apagada.", "ok");
        await message.reply({ embeds: [embed] });
        return;
      }

      const userText = parts.join(" ").trim();
      const attachments = [...message.attachments.values()];

      if (!userText && attachments.length === 0) {
        const fields = [
          { name: "Chat normal", value: `\`${prefix}fwp <mensagem>\``, inline: false },
          { name: "Enviar arquivo", value: `\`${prefix}fwp [mensagem]\` + anexo`, inline: false },
          { name: "Limpar memória", value: `\`${prefix}fwp limpar\``, inline: false }
        ];
        const embed = buildEmbedFields("Fawers — Uso", fields, "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      const start = Date.now();
      let systemPrompt = "";
      let fullQuery = userText;

      // Injeta perfis dos usuários mencionados (presença, cargos, atividade)
      if (message.mentions.users.size > 0 && message.guild) {
        const profileLines: string[] = [];
        for (const [, user] of message.mentions.users) {
          if (user.id === message.client.user?.id) continue;
          try {
            const member = await message.guild.members.fetch(user.id).catch(() => null);
            if (member) {
              profileLines.push(buildMemberProfile(member, `Mencionado`));
            } else {
              profileLines.push(`Mencionado: ${user.username} (ID: ${user.id}) — não encontrado no servidor`);
            }
          } catch {
            profileLines.push(`Mencionado: ${user.username} (ID: ${user.id})`);
          }
        }
        if (profileLines.length > 0) {
          fullQuery += `\n\n[Perfis dos usuários mencionados:\n${profileLines.join("\n")}]`;
        }
      }

      try {
        const trainingData = await loadTrainingData();
        systemPrompt = await buildAutonomousSystemPrompt(trainingData.compiledIdentity || trainingData.baseIdentity, message);

        const urls = [...userText.matchAll(/https?:\/\/[^\s<>()]+/g)].map((m) => m[0]).slice(0, 3);
        for (const url of urls) {
          try {
            const webContent = await safeFetch(url, undefined, { allowAnyPublicDomain: true, maxChars: 7000 });
            fullQuery += `\n\n[Conteúdo acessado da internet: ${url}]\n\`\`\`\n${webContent}\n\`\`\``;
            await recordMessageEvent("internet_fetch", message, `FWP acessou ${url}`, { url, ok: true });
          } catch (error) {
            const msg = error instanceof Error ? error.message : "erro desconhecido";
            fullQuery += `\n\n[Internet: não consegui acessar ${url}. Motivo: ${msg}]`;
            await recordMessageEvent("internet_fetch", message, `Falha ao acessar ${url}: ${msg}`, { url, ok: false });
          }
        }

        for (const att of attachments) {
          const fname = att.name ?? "arquivo";
          if (isTextAttachment(fname)) {
            const content = await readAttachmentText(att.url);
            fullQuery += `\n\n[Arquivo enviado: ${fname}]\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``;
          } else if (isImageAttachment(fname)) {
            fullQuery += `\n\n[Imagem enviada: ${fname} — análise de imagem não suportada neste momento]`;
          } else if (isPEFile(fname)) {
            fullQuery += `\n\n[Binário PE enviado: ${fname} — use \`${prefix}pe\` para análise completa de headers, imports e strings]`;
          } else {
            fullQuery += `\n\n[Arquivo binário enviado: ${fname} — não é possível ler o conteúdo]`;
          }
        }

        if (!fullQuery.trim()) fullQuery = "Analisa o arquivo enviado.";

        await recordMessageEvent("order_received", message, fullQuery, { mode: "fwp" });

        const { result: rawResponse, spinnerMsg } = await runWithSpinner(
          message,
          (_thinkingMessage, setStatusText) => retryOnceAfterOverload(
            () => queryFwp(systemPrompt, message.author.id, fullQuery),
            async () => {
              setStatusText(`${formatFwpError(new Error("503 unavailable"))}\n\nVou tentar cobrar a resposta de novo em 10s...`);
              await wait(10_000);
              setStatusText(null);
            }
          )
        );

        const actionReports = await executeFwpActions(message, rawResponse);
        const response = stripFwpActionBlocks(rawResponse);

        const files: AttachmentBuilder[] = [];

        if (hasCodeBlocks(response)) {
          const blocks = extractCodeBlocks(response);
          if (blocks.length === 1) {
            const buf = Buffer.from(blocks[0].code, "utf8");
            files.push(new AttachmentBuilder(buf, { name: blocks[0].filename }));
          } else if (blocks.length > 1) {
            const zipBuf = createZip(blocks.map((b) => ({ filename: b.filename, content: b.code })));
            files.push(new AttachmentBuilder(zipBuf, { name: "fawers_arquivos.zip" }));
          }
        }

        const finalResponse = actionReports.length > 0 ? `${response}\n\n${actionReports.join("\n")}` : response;
        const trimmed = truncate(finalResponse, 1900);
        const embed = buildEmbed("Fawers", trimmed, "action");

        await spinnerMsg.delete().catch(() => {});
        await message.reply({ embeds: [embed], files });
        logger.info({ command: "fwp", durationMs: Date.now() - start, files: files.length }, "Fwp executado");
      } catch (error) {
        let msg = formatFwpError(error);
        if (isFwpOverloadError(error)) {
          await enqueuePendingFwp(message, systemPrompt, message.author.id, fullQuery);
          msg += "\n\nJoguei tua pergunta numa fila interna; vou tentar cobrar essa resposta depois e mando aqui no canal se o provedor parar de passar fome.";
        }
        const embed = buildEmbed("Fawers engasgou", msg, "warn");
        await message.reply({ embeds: [embed] });
        logger.error({ error, command: "fwp" }, "Fwp falhou");
      }
      return;
    }

    if (command === "projeto") {
      const typeName = parts.shift()?.toLowerCase();
      const projectName = parts.join(" ").trim() || "meu_projeto";

      if (!typeName) {
        const fields = [
          { name: "Uso", value: `\`${prefix}projeto <tipo> [nome]\``, inline: false },
          { name: "Tipos disponíveis", value: "`python` `c` `cpp` `node` `rust` `asm`", inline: false },
          { name: "Exemplo", value: `\`${prefix}projeto python meu_bypass\``, inline: false }
        ];
        const embed = buildEmbedFields("Fawers — Projeto Base", fields, "info");
        await message.reply({ embeds: [embed] });
        return;
      }

      const type = resolveProjectType(typeName);
      if (!type) {
        const embed = buildEmbed("Tipo inválido", `Tipo \`${typeName}\` não reconhecido. Use: python, c, cpp, node, rust, asm`, "warn");
        await message.reply({ embeds: [embed] });
        return;
      }

      const temp = await message.reply("📦 Gerando projeto base...");
      try {
        const templateFiles = getProjectTemplate(type, projectName);
        const zipBuf = createZip(templateFiles);
        const zipFile = new AttachmentBuilder(zipBuf, { name: `${projectName}.zip` });

        const fileList = templateFiles.map((f) => `\`${f.filename}\``).join(", ");
        const embed = buildEmbed(
          `Projeto — ${projectName}`,
          `Tipo: \`${type}\`\nArquivos: ${fileList}`,
          "ok"
        );
        await temp.edit({ content: "", embeds: [embed], files: [zipFile] });
        logger.info({ command: "projeto", type, name: projectName }, "Projeto gerado");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha", msg, "error");
        await temp.edit({ content: "", embeds: [embed] });
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
