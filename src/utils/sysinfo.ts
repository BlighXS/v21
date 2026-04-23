import os from "node:os";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { logger } from "./logger.js";

const ROOT = process.cwd();
const MAX_FILE_SIZE = 1024 * 1024 * 2; // 2MB
const MAX_LINES = 5000;

export function getSystemInfo(): string {
  const totalMB = Math.round(os.totalmem() / 1024 / 1024);
  const freeMB = Math.round(os.freemem() / 1024 / 1024);
  const usedMB = totalMB - freeMB;

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  return [
    `[AMBIENTE DE EXECUÇÃO]`,
    `Sistema operacional: ${os.type()} ${os.release()} (${os.platform()}/${os.arch()})`,
    `Hostname: ${os.hostname()}`,
    `CPUs: ${os.cpus().length}x ${os.cpus()[0]?.model ?? "desconhecido"}`,
    `GPU: NVIDIA RTX A6000 (48 GB VRAM) — placa dedicada de alto desempenho`,
    `RAM total: ${totalMB} MB | usada: ${usedMB} MB | livre: ${freeMB} MB`,
    `Uptime do sistema: ${fmtUptime(os.uptime())}`,
    `Uptime do processo (bot): ${fmtUptime(process.uptime())}`,
    `Node.js: ${process.version}`,
    `Diretório raiz: ${ROOT}`,
    `PID: ${process.pid}`,
  ].join("\n");
}

function resolveSafePath(inputPath: string): string {
  const normalized = path.normalize(inputPath).replace(/^(\.\.[/\\])+/, "");
  const abs = path.join(ROOT, normalized);

  if (!abs.startsWith(ROOT)) {
    throw new Error("Caminho fora do projeto.");
  }

  return abs;
}

async function walkDir(dir: string, prefix = "", depth = 0): Promise<string[]> {
  if (depth > 6) return []; // limite de profundidade

  const lines: string[] = [];

  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return lines;
  }

  entries.sort();

  for (const entry of entries) {
    if (
      entry.startsWith(".") ||
      entry === "node_modules" ||
      entry === "dist" ||
      entry === "__pycache__"
    )
      continue;

    const full = path.join(dir, entry);

    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }

    if (s.isDirectory()) {
      lines.push(`${prefix}${entry}/`);
      const sub = await walkDir(full, `${prefix}  `, depth + 1);
      lines.push(...sub);
    } else {
      lines.push(`${prefix}${entry}`);
    }
  }

  return lines;
}

export async function getSourceTree(): Promise<string> {
  const srcDir = path.join(ROOT, "src");
  const artifactsDir = path.join(ROOT, "artifacts");
  const libDir = path.join(ROOT, "lib");
  const scriptsDir = path.join(ROOT, "scripts");

  const srcLines = await walkDir(srcDir, "  ");
  const artifactsLines = await walkDir(artifactsDir, "  ").catch(() => []);
  const libLines = await walkDir(libDir, "  ").catch(() => []);
  const scriptsLines = await walkDir(scriptsDir, "  ").catch(() => []);

  // Top-level files (package.json, configs, replit.md etc) — sem descer em pastas
  const rootFiles: string[] = [];
  try {
    const entries = await readdir(ROOT);
    entries.sort();
    for (const e of entries) {
      if (e.startsWith(".") || e === "node_modules") continue;
      try {
        const s = await stat(path.join(ROOT, e));
        if (s.isFile()) rootFiles.push(`  ${e}`);
      } catch {}
    }
  } catch {}

  const sections = [
    "[ESTRUTURA DO PROJETO — RAIZ]",
    ...rootFiles,
    "",
    "[CÓDIGO FONTE — src/]",
    ...srcLines,
  ];

  if (artifactsLines.length > 0) {
    sections.push("", "[ARTIFACTS — dashboard web e API]", ...artifactsLines);
  }

  if (libLines.length > 0) {
    sections.push("", "[LIB — bibliotecas compartilhadas]", ...libLines);
  }

  if (scriptsLines.length > 0) {
    sections.push("", "[SCRIPTS — utilitários de manutenção]", ...scriptsLines);
  }

  return sections.join("\n");
}

export async function readSourceFile(
  filePath: string,
  fromLine?: number,
  toLine?: number,
): Promise<string> {
  const abs = resolveSafePath(filePath);

  const { readFile, stat } = await import("node:fs/promises");

  const fileStat = await stat(abs);

  if (fileStat.size > MAX_FILE_SIZE) {
    throw new Error("Arquivo muito grande para leitura.");
  }

  const content = await readFile(abs, "utf8");

  if (fromLine === undefined && toLine === undefined) {
    return content.slice(0, MAX_FILE_SIZE);
  }

  const lines = content.split("\n");
  const total = lines.length;

  const start = Math.max(0, (fromLine ?? 1) - 1);
  const end = toLine !== undefined ? Math.min(total, toLine) : total;

  if (end - start > MAX_LINES) {
    throw new Error("Intervalo de linhas muito grande.");
  }

  const slice = lines.slice(start, end).join("\n");

  return `[linhas ${start + 1}–${end} de ${total} | ${filePath}]\n${slice}`;
}

export async function writeSourceFile(
  filePath: string,
  content: string,
): Promise<void> {
  const abs = resolveSafePath(filePath);

  if (content.length > MAX_FILE_SIZE) {
    throw new Error("Conteúdo muito grande.");
  }

  // Bloqueio apenas de arquivos de ambiente e dependências — o dono tem acesso total ao código-fonte
  const BLOCKED_PATTERNS = [
    "node_modules",
    ".env",
    "pnpm-lock.yaml",
    "package-lock.json",
    "faw.env",
  ];

  const relPath = abs.slice(ROOT.length + 1).replace(/\\/g, "/");

  const blockedByPattern = BLOCKED_PATTERNS.some((p) => abs.includes(p));

  if (blockedByPattern) {
    throw new Error(`Escrita em arquivo restrito: \`${relPath}\`. Arquivos de ambiente e dependências não podem ser alterados.`);
  }

  const { writeFile, mkdir } = await import("node:fs/promises");

  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");

  logger.warn({ filePath }, "Arquivo modificado pela IA");
}

export async function listSourceFiles(dir = "src"): Promise<string[]> {
  const target = resolveSafePath(dir);
  return walkDir(target);
}
