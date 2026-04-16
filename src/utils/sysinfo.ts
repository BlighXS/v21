import os from "node:os";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

export function getSystemInfo(): string {
  const totalMB = Math.round(os.totalmem() / 1024 / 1024);
  const freeMB = Math.round(os.freemem() / 1024 / 1024);
  const usedMB = totalMB - freeMB;
  const uptimeSec = Math.floor(os.uptime());
  const procUptimeSec = Math.floor(process.uptime());

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
    `RAM total: ${totalMB} MB | usada: ${usedMB} MB | livre: ${freeMB} MB`,
    `Uptime do sistema: ${fmtUptime(uptimeSec)}`,
    `Uptime do processo (bot): ${fmtUptime(procUptimeSec)}`,
    `Node.js: ${process.version}`,
    `Diretório raiz: ${ROOT}`,
    `PID: ${process.pid}`
  ].join("\n");
}

async function walkDir(dir: string, prefix = ""): Promise<string[]> {
  const lines: string[] = [];
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return lines;
  }
  entries.sort();
  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "node_modules" || entry === "dist" || entry === "__pycache__") continue;
    const full = path.join(dir, entry);
    let s;
    try { s = await stat(full); } catch { continue; }
    if (s.isDirectory()) {
      lines.push(`${prefix}${entry}/`);
      const sub = await walkDir(full, `${prefix}  `);
      lines.push(...sub);
    } else {
      lines.push(`${prefix}${entry}`);
    }
  }
  return lines;
}

export async function getSourceTree(): Promise<string> {
  const srcDir = path.join(ROOT, "src");
  const lines = await walkDir(srcDir, "  ");
  return ["[ESTRUTURA DO CÓDIGO FONTE — src/]", ...lines].join("\n");
}

export async function readSourceFile(filePath: string): Promise<string> {
  const safePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const abs = path.join(ROOT, safePath);
  if (!abs.startsWith(ROOT)) throw new Error("Caminho fora do projeto.");
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(abs, "utf8");
  return content;
}

export async function writeSourceFile(filePath: string, content: string): Promise<void> {
  const safePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const abs = path.join(ROOT, safePath);
  if (!abs.startsWith(ROOT)) throw new Error("Caminho fora do projeto.");
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
}

export async function listSourceFiles(dir = "src"): Promise<string[]> {
  const target = path.join(ROOT, dir);
  const lines = await walkDir(target);
  return lines;
}
