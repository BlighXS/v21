import { AttachmentBuilder } from "discord.js";
import type { GuildMember } from "discord.js";
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
import { loadUserMemory, appendToUserMemory, clearUserMemory } from "../ai/memory.js";
import { extractCodeBlocks, hasCodeBlocks, createZip, readAttachmentText, isTextAttachment, isImageAttachment } from "../ai/fileOps.js";
import { downloadAndParsePE, formatPEReport, buildStringsAttachment, isPEFile } from "../ai/binaryAnalysis.js";
import { resolveProjectType, getProjectTemplate } from "../ai/projectTemplates.js";
import { enableFreeMode, disableFreeMode, isFreeModeActive, isFreeModeOwner, FREE_MODE_SYSTEM_SUFFIX } from "../ai/freeMode.js";

function canRestart(member: GuildMember): boolean {
  if (config.RESTART_ROLE_IDS.length === 0) return isAdminMember(member);
  return member.roles.cache.some((role) => config.RESTART_ROLE_IDS.includes(role.id));
}

async function queryFwp(
  systemPrompt: string,
  userId: string,
  userQuery: string
): Promise<string> {
  const { Ollama } = await import("ollama");
  const ollama = new Ollama({ host: config.OLLAMA_HOST });

  const history = await loadUserMemory(userId);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userQuery }
  ];

  const response = await ollama.chat({ model: config.OLLAMA_MODEL, messages });
  const reply = response.message?.content?.trim() || "Sem resposta gerada.";

  await appendToUserMemory(userId, userQuery, reply);
  return reply;
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
    const systemPrompt = basePrompt + FREE_MODE_SYSTEM_SUFFIX;

    const author = message.author;
    const display = message.member?.displayName ?? author.username;
    const userQuery = `[${display} (<@${author.id}>)]: ${content || "(mensagem sem texto)"}`;

    const memoryKey = `channel_${message.channelId}`;
    const history = await loadUserMemory(memoryKey);

    const { Ollama } = await import("ollama");
    const ollama = new Ollama({ host: config.OLLAMA_HOST });

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userQuery }
    ];

    const response = await ollama.chat({ model: config.OLLAMA_MODEL, messages });
    const reply = response.message?.content?.trim() || "[SILENT]";

    await appendToUserMemory(memoryKey, userQuery, reply);

    if (reply.startsWith("[SILENT]")) {
      logger.info({ channel: message.channelId }, "Free mode: Fawers optou por silêncio");
      return true;
    }

    const trimmed = truncate(reply, 1900);
    await message.channel.send(trimmed);
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
          name: "\u2022 Fawers IA",
          value: [
            `\`${prefix}fwp <msg>\` \u2014 Chat com a IA`,
            `\`${prefix}fwp\` + anexo \u2014 Envia arquivo para a IA`,
            `\`${prefix}fwp limpar\` \u2014 Apaga mem\u00f3ria`,
            `\`${prefix}ufwp\` \u2014 Desbloqueia a IA no canal`,
            `\`${prefix}lfwp\` \u2014 Bloqueia a IA de volta`,
            `\`${prefix}pe\` + .exe/.dll \u2014 An\u00e1lise de bin\u00e1rio PE`,
            `\`${prefix}projeto <tipo> [nome]\` \u2014 Gera projeto ZIP`,
            `\`${prefix}spf <pesquisa>\` \u2014 Busca Spotify`,
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
      const trainingData = await loadTrainingData();
      const systemPrompt = (trainingData.compiledIdentity || trainingData.baseIdentity) + FREE_MODE_SYSTEM_SUFFIX;
      const intro = await (async () => {
        try {
          const { Ollama } = await import("ollama");
          const ollama = new Ollama({ host: config.OLLAMA_HOST });
          const res = await ollama.chat({
            model: config.OLLAMA_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: "Você acabou de ser liberada para falar livremente neste canal. Diga algo breve para marcar sua presença." }
            ]
          });
          return res.message?.content?.trim() || null;
        } catch {
          return null;
        }
      })();
      const embed = buildEmbed("Fawers — Modo Livre ativado", "A IA está desbloqueada neste canal. Ela vai interagir por conta própria.", "ok");
      await message.reply({ embeds: [embed] });
      if (intro && !intro.startsWith("[SILENT]")) {
        await message.channel.send(truncate(intro, 1900));
      }
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

      const temp = await message.reply("\u{1F9E0} Fawers processando...");
      const start = Date.now();

      try {
        const trainingData = await loadTrainingData();
        const systemPrompt = trainingData.compiledIdentity || trainingData.baseIdentity;

        let fullQuery = userText;

        for (const att of attachments) {
          const fname = att.name ?? "arquivo";
          if (isTextAttachment(fname)) {
            const content = await readAttachmentText(att.url);
            fullQuery += `\n\n[Arquivo enviado: ${fname}]\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``;
          } else if (isImageAttachment(fname)) {
            fullQuery += `\n\n[Imagem enviada: ${fname} — análise de imagem não suportada neste modelo]`;
          } else if (isPEFile(fname)) {
            fullQuery += `\n\n[Binário PE enviado: ${fname} — use \`${prefix}pe\` para análise completa de headers, imports e strings]`;
          } else {
            fullQuery += `\n\n[Arquivo binário enviado: ${fname} — não é possível ler o conteúdo]`;
          }
        }

        if (!fullQuery.trim()) fullQuery = "Analisa o arquivo enviado.";

        const response = await queryFwp(systemPrompt, message.author.id, fullQuery);

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

        const trimmed = truncate(response, 1900);
        const embed = buildEmbed("Fawers", trimmed, "action");

        await temp.edit({ content: "", embeds: [embed], files });
        logger.info({ command: "fwp", durationMs: Date.now() - start, files: files.length }, "Fwp executado");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        const embed = buildEmbed("Falha — Fawers", msg, "error");
        await temp.edit({ content: "", embeds: [embed] });
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
