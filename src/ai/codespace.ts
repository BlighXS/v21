import { exec } from "node:child_process";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { AttachmentBuilder } from "discord.js";
import type { Message } from "discord.js";
import { recordMessageEvent } from "./memorial.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export const CODESPACE_DIR = path.resolve(process.cwd(), "src", "fawers_codespaces");

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12_000;
const AI_MAX_CHARS = 8000;

/**
 * Fetch irrestrito para a IA — aceita http/https, segue redirects, usa User-Agent de browser.
 * Tenta Node fetch nativo primeiro; cai no curl do codespace se falhar.
 */
export async function aiFetch(rawUrl: string, maxChars = AI_MAX_CHARS): Promise<string> {
  // normaliza: se não tiver protocolo, adiciona https://
  let targetUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

  // Tenta fetch nativo
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      });
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    const prefix = response.ok ? "" : `[HTTP ${response.status}]\n`;
    const trimmed = text.length > maxChars ? text.slice(0, maxChars) + "\n...[truncado]" : text;
    return prefix + trimmed;
  } catch (nativeErr) {
    logger.warn({ url: targetUrl, err: String(nativeErr) }, "aiFetch nativo falhou, tentando curl");
  }

  // Fallback: curl via codespace shell
  await ensureCodespaceDir();
  const curlCmd = `curl -sL --max-time 20 -A "${BROWSER_UA}" -o /tmp/_aifetch_out.txt -w "%{http_code}" "${targetUrl.replace(/"/g, '\\"')}" 2>&1 && cat /tmp/_aifetch_out.txt`;
  try {
    const { stdout } = await execAsync(curlCmd, { cwd: CODESPACE_DIR, timeout: 25_000, shell: "/bin/bash" });
    const trimmed = stdout.length > maxChars ? stdout.slice(0, maxChars) + "\n...[truncado]" : stdout;
    return `[via curl]\n${trimmed}`;
  } catch (curlErr) {
    throw new Error(`Fetch falhou (nativo + curl): ${curlErr instanceof Error ? curlErr.message : String(curlErr)}`);
  }
}

const SHELL_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 6000;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

async function ensureCodespaceDir(): Promise<void> {
  if (!existsSync(CODESPACE_DIR)) {
    await mkdir(CODESPACE_DIR, { recursive: true });
  }
}

function safeRelPath(filePath: string): string {
  const rel = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  return rel;
}

function resolveInsideCodespace(filePath: string): string {
  const rel = safeRelPath(filePath);
  return path.join(CODESPACE_DIR, rel);
}

export async function csShellExec(command: string): Promise<string> {
  await ensureCodespaceDir();
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: CODESPACE_DIR,
      timeout: SHELL_TIMEOUT_MS,
      shell: "/bin/bash",
      env: { ...process.env, HOME: CODESPACE_DIR },
    });
    const out = (stdout + (stderr ? `\n[stderr]\n${stderr}` : "")).trim();
    return out.length > MAX_OUTPUT_CHARS
      ? out.slice(0, MAX_OUTPUT_CHARS) + "\n...[output truncado]"
      : out || "(sem output)";
  } catch (err: any) {
    const out = ((err.stdout ?? "") + "\n" + (err.stderr ?? "")).trim();
    const msg = err.signal === "SIGTERM" ? "Timeout — comando encerrado após 30s." : String(err.message ?? err);
    return `[ERRO] ${msg}${out ? `\n${out.slice(0, 2000)}` : ""}`;
  }
}

export async function csWriteFile(filePath: string, content: string): Promise<string> {
  await ensureCodespaceDir();
  const full = resolveInsideCodespace(filePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content, "utf-8");
  return `Arquivo escrito: \`${safeRelPath(filePath)}\``;
}

export async function csReadFile(filePath: string): Promise<string> {
  await ensureCodespaceDir();
  const full = resolveInsideCodespace(filePath);
  if (!existsSync(full)) return `Arquivo não encontrado: \`${safeRelPath(filePath)}\``;
  const info = await stat(full);
  if (info.size > MAX_FILE_SIZE_BYTES) return `Arquivo muito grande (${(info.size / 1024).toFixed(1)}KB). Use shell_exec com head/tail.`;
  const content = await readFile(full, "utf-8");
  const preview = content.length > MAX_OUTPUT_CHARS
    ? content.slice(0, MAX_OUTPUT_CHARS) + "\n...[truncado]"
    : content;
  return `[${safeRelPath(filePath)}]\n\`\`\`\n${preview}\n\`\`\``;
}

export async function csListFiles(subDir = "."): Promise<string> {
  await ensureCodespaceDir();
  const full = resolveInsideCodespace(subDir);
  if (!existsSync(full)) return `Diretório não encontrado: \`${subDir}\``;
  try {
    const { stdout } = await execAsync(`find . -maxdepth 4 -not -path '*/node_modules/*' -not -path '*/.git/*' | sort`, {
      cwd: full,
      timeout: 5000,
      shell: "/bin/bash",
    });
    return `[Arquivos em codespace/${subDir === "." ? "" : subDir}]\n${stdout.trim() || "(vazio)"}`;
  } catch {
    const entries = await readdir(full).catch(() => [] as string[]);
    return `[Arquivos em codespace/]\n${entries.join("\n") || "(vazio)"}`;
  }
}

export async function csSendFile(message: Message, filePath: string): Promise<string> {
  await ensureCodespaceDir();
  const full = resolveInsideCodespace(filePath);
  if (!existsSync(full)) return `Arquivo não encontrado para envio: \`${safeRelPath(filePath)}\``;
  const info = await stat(full);
  if (info.size > 8 * 1024 * 1024) return `Arquivo muito grande para enviar pelo Discord (limite ~8MB).`;
  const buffer = await readFile(full);
  const name = path.basename(full);
  const attachment = new AttachmentBuilder(buffer, { name });
  await message.channel.send({ files: [attachment] });
  await recordMessageEvent("ai_action", message, `Arquivo enviado via codespace: ${safeRelPath(filePath)}`, { action: "cs_send_file", filePath });
  return `Arquivo **${name}** enviado para o canal.`;
}
