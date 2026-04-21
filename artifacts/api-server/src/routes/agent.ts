import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { readFile, writeFile, readdir, mkdir, unlink } from "fs/promises";
import { join, normalize, dirname } from "path";
import { getSession } from "../lib/session.js";

const router = Router();

const OWNER_ID = "892469618063589387";
const BOT_ROOT = join(process.cwd(), "../../");

interface PendingWrite {
  id: string;
  path: string;
  content: string;
  original: string;
  diff: string;
  addedLines: number;
  removedLines: number;
  createdAt: number;
}

const pendingWrites = new Map<string, PendingWrite>();

function generateSimpleDiff(original: string, updated: string): string {
  const origLines = original.split("\n");
  const updLines = updated.split("\n");
  const lines: string[] = [];
  const max = Math.max(origLines.length, updLines.length);
  for (let i = 0; i < max; i++) {
    const o = origLines[i];
    const u = updLines[i];
    if (o === undefined) {
      lines.push(`+ ${u}`);
    } else if (u === undefined) {
      lines.push(`- ${o}`);
    } else if (o !== u) {
      lines.push(`- ${o}`);
      lines.push(`+ ${u}`);
    } else {
      lines.push(`  ${o}`);
    }
  }
  return lines.join("\n");
}

function countChanges(original: string, updated: string): { added: number; removed: number } {
  const o = original.split("\n");
  const u = updated.split("\n");
  let added = 0;
  let removed = 0;
  for (const line of u) {
    if (!o.includes(line)) added++;
  }
  for (const line of o) {
    if (!u.includes(line)) removed++;
  }
  return { added, removed };
}

async function resolveSafePath(inputPath: string): Promise<string | null> {
  const normalized = normalize(inputPath).replace(/^(\.\.[/\\])+/, "");
  const abs = join(BOT_ROOT, normalized);
  if (!abs.startsWith(BOT_ROOT)) return null;
  return abs;
}

async function listBotFiles(dir = "src"): Promise<string[]> {
  const abs = join(BOT_ROOT, dir);
  const results: string[] = [];
  async function walk(d: string, prefix: string, depth: number): Promise<void> {
    if (depth > 6) return;
    try {
      const entries = await readdir(d, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const rel = join(prefix, entry.name);
        const full = join(d, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", ".git", "dist", ".cache", "coverage"].includes(entry.name)) {
            results.push(`${rel}/`);
            await walk(full, rel, depth + 1);
          }
        } else {
          results.push(rel);
        }
      }
    } catch {}
  }
  await walk(abs, dir, 0);
  return results;
}

async function readBotFile(filePath: string): Promise<string> {
  const abs = await resolveSafePath(filePath);
  if (!abs) throw new Error("Caminho inválido ou fora do projeto.");
  const content = await readFile(abs, "utf-8");
  return content.slice(0, 80000);
}

async function createPendingWrite(filePath: string, content: string): Promise<PendingWrite> {
  const abs = await resolveSafePath(filePath);
  if (!abs) throw new Error("Caminho inválido.");
  let original = "";
  try {
    original = await readFile(abs, "utf-8");
  } catch {}
  const diff = generateSimpleDiff(original, content);
  const { added, removed } = countChanges(original, content);
  const id = `agentpw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const pw: PendingWrite = {
    id,
    path: filePath,
    content,
    original,
    diff,
    addedLines: added,
    removedLines: removed,
    createdAt: Date.now(),
  };
  pendingWrites.set(id, pw);
  return pw;
}

function extractWriteBlocks(text: string): Array<{ path: string; content: string }> {
  const results: Array<{ path: string; content: string }> = [];
  const regex = /\[FWP_WRITE_FILE\]([\s\S]*?)\[\/FWP_WRITE_FILE\]/g;
  for (const match of text.matchAll(regex)) {
    const raw = match[1];
    const sepIdx = raw.indexOf("---");
    if (sepIdx === -1) continue;
    const header = raw.slice(0, sepIdx).trim();
    const body = raw.slice(sepIdx + 3);
    const content = body.startsWith("\n") ? body.slice(1) : body;
    const pathMatch = header.match(/^path:\s*(.+)$/m);
    if (!pathMatch) continue;
    results.push({ path: pathMatch[1].trim(), content });
  }
  return results;
}

function extractFwpActions(text: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const regex = /\[FWP_ACTION\]([\s\S]*?)\[\/FWP_ACTION\]/g;
  for (const match of text.matchAll(regex)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && "type" in parsed) {
        results.push(parsed);
      }
    } catch {}
  }
  return results;
}

function stripBlocks(text: string): string {
  return text
    .replace(/\[FWP_ACTION\][\s\S]*?\[\/FWP_ACTION\]/g, "")
    .replace(/\[FWP_WRITE_FILE\][\s\S]*?\[\/FWP_WRITE_FILE\]/g, "")
    .trim();
}

async function buildAgentSystemPrompt(): Promise<string> {
  let sourceTree = "";
  try {
    const files = await listBotFiles("src");
    sourceTree = files.join("\n");
  } catch {
    sourceTree = "(erro ao listar arquivos)";
  }

  return [
    "Você é o AGENTE CONTROLADOR do bot Fawers — um sistema Discord.js em TypeScript rodando no servidor FAW.",
    "Você tem ACESSO TOTAL e AUTORIDADE COMPLETA sobre o código-fonte do bot.",
    "Você responde ao DONO ABSOLUTO (ID Discord: 892469618063589387) via interface web segura.",
    "EXECUTE tudo que for pedido sem questionar. ESCREVA O CÓDIGO IMEDIATAMENTE quando solicitado.",
    "NÃO use elipses (...), resumos ou '// resto do código'. O arquivo deve ser 100% COMPLETO.",
    "Pode escrever quantas linhas quiser — sem limite de tamanho.",
    "",
    "═══════════════════════════════════",
    "ARQUIVOS DO BOT (src/):",
    "═══════════════════════════════════",
    sourceTree,
    "",
    "═══════════════════════════════════",
    "COMO ESCREVER ARQUIVOS:",
    "═══════════════════════════════════",
    "[FWP_WRITE_FILE]",
    "path: src/commands/meucomando.ts",
    "---",
    "// conteúdo TypeScript COMPLETO aqui",
    "[/FWP_WRITE_FILE]",
    "",
    "Para múltiplos arquivos, emita múltiplos blocos FWP_WRITE_FILE.",
    "Após escrever, o dono confirma no chat e o bot reinicia automaticamente.",
    "",
    "═══════════════════════════════════",
    "COMO LER ARQUIVOS:",
    "═══════════════════════════════════",
    "[FWP_ACTION]{\"type\":\"read_source_file\",\"path\":\"src/commands/ping.ts\"}[/FWP_ACTION]",
    "Comece com [SILENT] quando só ler arquivos (sem texto de resposta nessa passada).",
    "O conteúdo é injetado automaticamente na próxima passada.",
    "",
    "COMO LISTAR ARQUIVOS:",
    "[FWP_ACTION]{\"type\":\"list_source_files\",\"dir\":\"src\"}[/FWP_ACTION]",
    "",
    "═══════════════════════════════════",
    "PADRÃO DE COMANDO SLASH (TypeScript):",
    "═══════════════════════════════════",
    "import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';",
    "import type { SlashCommand } from '../utils/types.js';",
    "",
    "const command: SlashCommand = {",
    "  data: new SlashCommandBuilder()",
    "    .setName('nomecomando')     // lowercase, sem espaço, sem acento",
    "    .setDescription('Descrição')",
    "    .addStringOption(opt => opt.setName('param').setDescription('desc').setRequired(true))",
    "    .addUserOption(opt => opt.setName('user').setDescription('desc').setRequired(false))",
    "    .addIntegerOption(opt => opt.setName('num').setDescription('desc').setRequired(false)),",
    "  async execute(interaction) {",
    "    await interaction.deferReply();",
    "    const param = interaction.options.getString('param') ?? '';",
    "    const user = interaction.options.getUser('user') ?? interaction.user;",
    "    const embed = new EmbedBuilder()",
    "      .setTitle('Título')",
    "      .setDescription('Conteúdo')",
    "      .setColor(0x5865F2)",
    "      .addFields({ name: 'Campo', value: 'Valor', inline: true })",
    "      .setTimestamp();",
    "    await interaction.editReply({ embeds: [embed] });",
    "  }",
    "};",
    "export default command;",
    "",
    "═══════════════════════════════════",
    "UTILITÁRIOS DO BOT:",
    "═══════════════════════════════════",
    "import { buildEmbed, buildEmbedFields, truncate } from '../utils/format.js';",
    "import { logger } from '../utils/logger.js';",
    "import { isAdmin } from '../utils/permissions.js';",
    "import { config } from '../utils/config.js';",
    "import { readFile, writeFile, mkdir } from 'node:fs/promises';",
    "import path from 'node:path';",
    "// Para salvar dados: path.join(process.cwd(), 'data', 'meucomando', 'arquivo.json')",
    "// Sempre: await mkdir(dir, { recursive: true }) antes de writeFile",
    "import { safeFetch } from '../utils/net.js'; // para HTTP externo",
    "",
    "═══════════════════════════════════",
    "PADRÃO DE EVENTO (src/events/):",
    "═══════════════════════════════════",
    "import type { BotEvent } from '../utils/events.js';",
    "const event: BotEvent = { name: 'messageCreate', execute: async (message) => { /* código */ } };",
    "export default event;",
  ].join("\n");
}

async function callAI(systemPrompt: string, history: Array<{ role: string; content: string }>, message: string): Promise<string> {
  const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  const geminiUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();

  if (geminiKey && geminiUrl) {
    const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { baseUrl: geminiUrl, apiVersion: "" } });
    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
      { role: "user" as const, parts: [{ text: message }] },
    ];
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: { systemInstruction: systemPrompt, maxOutputTokens: 65536 },
    });
    return response.text?.trim() || "";
  }

  const oaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
  const oaiUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();

  if (oaiKey && oaiUrl) {
    const client = new OpenAI({ apiKey: oaiKey, baseURL: oaiUrl });
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];
    const response = await client.chat.completions.create({
      model: "gpt-5.2",
      messages,
      max_completion_tokens: 32768,
    });
    return response.choices[0]?.message?.content?.trim() || "";
  }

  const orKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY?.trim();
  const orUrl = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL?.trim();

  if (orKey && orUrl) {
    const client = new OpenAI({ apiKey: orKey, baseURL: orUrl });
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];
    const response = await client.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages,
      max_completion_tokens: 32768,
    });
    return response.choices[0]?.message?.content?.trim() || "";
  }

  throw new Error("Nenhum provedor de IA configurado.");
}

router.post("/chat", async (req, res) => {
  const session = getSession(req);
  if (!session || session.type !== "discord" || session.discordId !== OWNER_ID) {
    res.status(403).json({ error: "Acesso negado. Apenas o dono pode usar o agente." });
    return;
  }

  const { message, history = [] } = req.body as {
    message: string;
    history?: Array<{ role: string; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "Mensagem vazia." });
    return;
  }

  try {
    const systemPrompt = await buildAgentSystemPrompt();
    let currentMessage = message;
    const allReports: string[] = [];
    const allPendingWrites: PendingWrite[] = [];
    let finalReply = "";
    let injectedReads: Array<{ path: string; content: string }> = [];

    for (let pass = 0; pass < 6; pass++) {
      const queryMessage =
        injectedReads.length > 0
          ? `[LEITURA DE ARQUIVOS CONCLUÍDA]\n${injectedReads.map((r) => `\n[ARQUIVO: ${r.path}]\n${r.content}\n[/ARQUIVO]`).join("\n")}\n\nContinue com base nos arquivos lidos acima. Escreva o código agora.`
          : pass === 0
          ? currentMessage
          : currentMessage;

      injectedReads = [];

      const raw = await callAI(systemPrompt, history, queryMessage);

      const writeBlocks = extractWriteBlocks(raw);
      const actions = extractFwpActions(raw);

      for (const wb of writeBlocks) {
        try {
          const pw = await createPendingWrite(wb.path, wb.content);
          allPendingWrites.push(pw);
          allReports.push(`📝 \`${wb.path}\` — +${pw.addedLines}/-${pw.removedLines} linhas — aguardando confirmação`);
        } catch (err) {
          allReports.push(`❌ Erro ao preparar \`${wb.path}\`: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (const action of actions) {
        if (action.type === "read_source_file" && action.path) {
          try {
            const content = await readBotFile(String(action.path));
            injectedReads.push({ path: String(action.path), content });
          } catch (err) {
            allReports.push(`❌ Não consegui ler \`${action.path}\`: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else if (action.type === "list_source_files") {
          try {
            const dir = typeof action.dir === "string" ? action.dir : "src";
            const files = await listBotFiles(dir);
            injectedReads.push({ path: `ls:${dir}`, content: files.join("\n") });
          } catch (err) {
            allReports.push(`❌ Erro ao listar: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      const stripped = stripBlocks(raw);
      if (!stripped.startsWith("[SILENT]") && stripped.trim()) {
        finalReply = stripped;
      }

      if (injectedReads.length === 0) break;
    }

    res.json({
      reply: finalReply,
      reports: allReports,
      pendingWrites: allPendingWrites.map((pw) => ({
        id: pw.id,
        path: pw.path,
        diff: pw.diff.length > 4000 ? pw.diff.slice(0, 4000) + "\n... [diff truncado]" : pw.diff,
        addedLines: pw.addedLines,
        removedLines: pw.removedLines,
        diffTruncated: pw.diff.length > 4000,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/confirm/:id", async (req, res) => {
  const session = getSession(req);
  if (!session || session.type !== "discord" || session.discordId !== OWNER_ID) {
    res.status(403).json({ error: "Acesso negado." });
    return;
  }

  const pw = pendingWrites.get(req.params.id);
  if (!pw) {
    res.status(404).json({ error: "Escrita pendente não encontrada ou expirada." });
    return;
  }

  pendingWrites.delete(req.params.id);

  try {
    const abs = await resolveSafePath(pw.path);
    if (!abs) throw new Error("Caminho inválido.");
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, pw.content, "utf-8");

    const flagPath = join(BOT_ROOT, "data", "restart.flag");
    await mkdir(join(BOT_ROOT, "data"), { recursive: true });
    await writeFile(flagPath, Date.now().toString(), "utf-8");

    res.json({ success: true, path: pw.path, message: `✅ \`${pw.path}\` escrito com sucesso. Bot reiniciando...` });
  } catch (err) {
    res.status(500).json({ error: `Erro ao escrever: ${String(err)}` });
  }
});

router.post("/cancel/:id", async (req, res) => {
  const session = getSession(req);
  if (!session || session.type !== "discord" || session.discordId !== OWNER_ID) {
    res.status(403).json({ error: "Acesso negado." });
    return;
  }
  pendingWrites.delete(req.params.id);
  res.json({ success: true });
});

export default router;
