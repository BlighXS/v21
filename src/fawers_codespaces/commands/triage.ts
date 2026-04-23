import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { EmbedBuilder } from 'discord.js';
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const exec = promisify(_exec);

type TriageResult = {
  file: string;
  size: number;
  sha256?: string;
  sha1?: string;
  md5?: string;
  fileType?: string;
  entropy?: number;
  magic?: string;
  stringsTop?: string[];
  pe?: {
    isPE: boolean;
    arch?: string;
    subsystem?: string;
    compileTime?: string;
    imphash?: string;
    suspiciousSections?: string[];
  };
  elf?: {
    isELF: boolean;
    arch?: string;
    interpreter?: string;
    rpath?: string;
    runpath?: string;
  };
  hints?: string[];
};

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function cmdExists(cmd: string): Promise<boolean> {
  try {
    await exec(`bash -lc "command -v ${cmd} >/dev/null 2>&1"`);
    return true;
  } catch {
    return false;
  }
}

function shQuote(p: string) {
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

async function entropyBytes(filePath: string): Promise<number | undefined> {
  try {
    const buf = await readFile(filePath);
    if (!buf.length) return 0;
    const freq = new Array<number>(256).fill(0);
    for (const b of buf) freq[b]++;
    let ent = 0;
    for (const c of freq) {
      if (!c) continue;
      const p = c / buf.length;
      ent -= p * Math.log2(p);
    }
    return Number(ent.toFixed(4));
  } catch {
    return undefined;
  }
}

async function hashAll(filePath: string) {
  const out: any = {};
  const q = shQuote(filePath);
  try {
    const { stdout } = await exec(`bash -lc "sha256sum ${q} | awk '{print $1}'"`);
    out.sha256 = stdout.trim();
  } catch {}
  try {
    const { stdout } = await exec(`bash -lc "sha1sum ${q} | awk '{print $1}'"`);
    out.sha1 = stdout.trim();
  } catch {}
  try {
    const { stdout } = await exec(`bash -lc "md5sum ${q} | awk '{print $1}'"`);
    out.md5 = stdout.trim();
  } catch {}
  return out as { sha256?: string; sha1?: string; md5?: string };
}

async function fileInfo(filePath: string) {
  const q = shQuote(filePath);
  let fileType = undefined as string | undefined;
  let magic = undefined as string | undefined;

  try {
    const { stdout } = await exec(`bash -lc "file -b ${q}"`);
    fileType = stdout.trim();
  } catch {}

  try {
    const { stdout } = await exec(`bash -lc "xxd -l 32 -g 1 ${q} 2>/dev/null | head -n 1"`);
    magic = stdout.trim();
  } catch {}

  return { fileType, magic };
}

async function topStrings(filePath: string): Promise<string[] | undefined> {
  const q = shQuote(filePath);
  try {
    const { stdout } = await exec(
      `bash -lc "strings -a -n 6 ${q} | head -n 40"`
    );
    const lines = stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return lines;
  } catch {
    return undefined;
  }
}

async function peInfo(filePath: string) {
  const q = shQuote(filePath);
  const isPE = await (async () => {
    try {
      const { stdout } = await exec(`bash -lc "file -b ${q}"`);
      return /PE32|MS-DOS executable/i.test(stdout);
    } catch {
      return false;
    }
  })();

  if (!isPE) return { isPE: false };

  const out: any = { isPE: true };
  const havePefile = await cmdExists('pefile');

  if (havePefile) {
    try {
      const { stdout } = await exec(
        `bash -lc "python3 - <<'PY'\nimport pefile,sys,hashlib,datetime\npe=pefile.PE(${JSON.stringify(filePath)})\nprint('Machine:',hex(pe.FILE_HEADER.Machine))\nprint('TimeDateStamp:',pe.FILE_HEADER.TimeDateStamp)\ntry:\n  dt=datetime.datetime.utcfromtimestamp(pe.FILE_HEADER.TimeDateStamp)\n  print('CompileTimeUTC:',dt.isoformat()+'Z')\nexcept Exception:\n  pass\nprint('Subsystem:',pe.OPTIONAL_HEADER.Subsystem)\ntry:\n  print('Imphash:',pe.get_imphash())\nexcept Exception:\n  pass\n# sections\nsusp=[]\nfor s in pe.sections:\n  name=s.Name.rstrip(b'\\x00').decode(errors='ignore')\n  ch=s.Characteristics\n  # heuristic: RWX or executable+write
  exec_flag=bool(ch & 0x20000000)\n  write_flag=bool(ch & 0x80000000)\n  if exec_flag and write_flag:\n    susp.append(name or '<noname>')\nprint('SuspiciousSections:',','.join(susp))\nPY"`
      );
      const lines = stdout.split('\n').map((l) => l.trim());
      for (const l of lines) {
        const [k, ...rest] = l.split(':');
        const v = rest.join(':').trim();
        if (!k || !v) continue;
        if (k === 'Machine') out.arch = v;
        if (k === 'Subsystem') out.subsystem = v;
        if (k === 'CompileTimeUTC') out.compileTime = v;
        if (k === 'Imphash') out.imphash = v;
        if (k === 'SuspiciousSections') out.suspiciousSections = v ? v.split(',').filter(Boolean) : [];
      }
    } catch {}
  } else {
    // fallback: readelf doesn't work for PE; keep minimal
  }

  return out as {
    isPE: boolean;
    arch?: string;
    subsystem?: string;
    compileTime?: string;
    imphash?: string;
    suspiciousSections?: string[];
  };
}

async function elfInfo(filePath: string) {
  const q = shQuote(filePath);
  const isELF = await (async () => {
    try {
      const { stdout } = await exec(`bash -lc "file -b ${q}"`);
      return /ELF/i.test(stdout);
    } catch {
      return false;
    }
  })();

  if (!isELF) return { isELF: false };

  const out: any = { isELF: true };
  try {
    const { stdout } = await exec(`bash -lc "readelf -h ${q} 2>/dev/null | egrep 'Class:|Machine:'"`);
    const s = stdout.trim();
    if (s) out.arch = s.replace(/\s+/g, ' ');
  } catch {}

  try {
    const { stdout } = await exec(`bash -lc "readelf -l ${q} 2>/dev/null | egrep 'Requesting program interpreter'"`);
    const m = stdout.match(/\[(.*)\]/);
    if (m?.[1]) out.interpreter = m[1];
  } catch {}

  try {
    const { stdout } = await exec(`bash -lc "readelf -d ${q} 2>/dev/null | egrep 'RPATH|RUNPATH'"`);
    const rpath = stdout.match(/RPATH.*\[(.*)\]/)?.[1];
    const runpath = stdout.match(/RUNPATH.*\[(.*)\]/)?.[1];
    if (rpath) out.rpath = rpath;
    if (runpath) out.runpath = runpath;
  } catch {}

  return out as {
    isELF: boolean;
    arch?: string;
    interpreter?: string;
    rpath?: string;
    runpath?: string;
  };
}

function buildHints(r: TriageResult): string[] {
  const hints: string[] = [];

  if (typeof r.entropy === 'number') {
    if (r.entropy >= 7.2) hints.push('Entropia alta (possível packer/criptografia/compressão).');
    else if (r.entropy <= 5.2) hints.push('Entropia baixa (pode ser texto/script/dados não compactados).');
  }

  const ft = r.fileType || '';
  if (/archive|zip|7-zip|gzip|bzip2|xz|rar/i.test(ft)) hints.push('Parece arquivo compactado: considerar extrair e triagem do conteúdo.');
  if (/Python script|ASCII text|UTF-8/i.test(ft)) hints.push('Parece texto/script: procura por URLs, chaves, comandos e IOCs.');
  if (/PE32|MS-DOS executable/i.test(ft)) hints.push('PE detectado: checar imports, seções RWX e imphash.');
  if (/ELF/i.test(ft)) hints.push('ELF detectado: checar dynamic section, interpreter e permissões.');

  if (r.pe?.suspiciousSections?.length) hints.push(`Seções PE suspeitas (RWX): ${r.pe.suspiciousSections.join(', ')}`);

  return hints;
}

async function downloadTo(url: string, outPath: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
}

export const prefixCommand: PrefixCommand = {
  trigger: 'triage',
  description: 'Triage rápida de arquivo (hashes, tipo, entropy, strings, PE/ELF hints). Uso: ;triage <caminho|url|anexo>',
  async execute(message: Message, args: string[]) {
    const baseDir = path.resolve(process.cwd(), 'triage');
    await ensureDir(baseDir);

    let filePath: string | null = null;
    let label = '';

    // 1) attachment
    const att = message.attachments.first();
    if (att) {
      const safeName = (att.name || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
      filePath = path.join(baseDir, `${Date.now()}_${safeName}`);
      label = `attachment:${att.name || safeName}`;
      try {
        await downloadTo(att.url, filePath);
      } catch (e: any) {
        await message.reply(`Falha ao baixar anexo: ${e?.message || e}`);
        return;
      }
    } else {
      const target = args.join(' ').trim();
      if (!target) {
        await message.reply('Uso: `;triage <caminho|url>` ou envie um arquivo anexado com `;triage`');
        return;
      }

      if (/^https?:\/\//i.test(target)) {
        const safeName = `url_${Date.now()}.bin`;
        filePath = path.join(baseDir, safeName);
        label = `url:${target}`;
        try {
          await downloadTo(target, filePath);
        } catch (e: any) {
          await message.reply(`Falha ao baixar URL: ${e?.message || e}`);
          return;
        }
      } else {
        filePath = path.resolve(process.cwd(), target);
        label = `path:${target}`;
      }
    }

    const result: TriageResult = {
      file: label,
      size: 0
    };

    // size
    try {
      const { stdout } = await exec(`bash -lc "stat -c %s ${shQuote(filePath)}"`);
      result.size = Number(stdout.trim() || '0');
    } catch {
      await message.reply('Não consegui acessar o arquivo. Confere o caminho/permissão.');
      return;
    }

    const hashes = await hashAll(filePath);
    result.sha256 = hashes.sha256;
    result.sha1 = hashes.sha1;
    result.md5 = hashes.md5;

    const finfo = await fileInfo(filePath);
    result.fileType = finfo.fileType;
    result.magic = finfo.magic;

    result.entropy = await entropyBytes(filePath);
    result.stringsTop = await topStrings(filePath);
    result.pe = await peInfo(filePath);
    result.elf = await elfInfo(filePath);
    result.hints = buildHints(result);

    const embed = new EmbedBuilder()
      .setTitle('Triage')
      .setColor(0x111111)
      .addFields(
        { name: 'Arquivo', value: `\`${result.file}\``, inline: false },
        { name: 'Tamanho', value: `${result.size} bytes`, inline: true },
        { name: 'Entropia', value: result.entropy?.toString() ?? 'n/a', inline: true },
        { name: 'Tipo (file)', value: result.fileType ? `\`${result.fileType}\`` : 'n/a', inline: false },
        { name: 'SHA256', value: result.sha256 ? `\`${result.sha256}\`` : 'n/a', inline: false },
        { name: 'MD5', value: result.md5 ? `\`${result.md5}\`` : 'n/a', inline: false }
      );

    const hints = (result.hints || []).slice(0, 8);
    if (hints.length) embed.addFields({ name: 'Hints', value: hints.map((h) => `- ${h}`).join('\n'), inline: false });

    const str = (result.stringsTop || []).slice(0, 12);
    if (str.length) embed.addFields({ name: 'Strings (top)', value: str.map((s) => `\`${s.slice(0, 80)}\``).join('\n'), inline: false });

    // extra PE/ELF
    if (result.pe?.isPE) {
      embed.addFields({
        name: 'PE',
        value: [
          result.pe.arch ? `arch: ${result.pe.arch}` : null,
          result.pe.subsystem ? `subsystem: ${result.pe.subsystem}` : null,
          result.pe.compileTime ? `compile: ${result.pe.compileTime}` : null,
          result.pe.imphash ? `imphash: ${result.pe.imphash}` : null
        ].filter(Boolean).join('\n') || 'ok',
        inline: false
      });
    }

    if (result.elf?.isELF) {
      embed.addFields({
        name: 'ELF',
        value: [
          result.elf.arch ? `${result.elf.arch}` : null,
          result.elf.interpreter ? `interp: ${result.elf.interpreter}` : null,
          result.elf.rpath ? `rpath: ${result.elf.rpath}` : null,
          result.elf.runpath ? `runpath: ${result.elf.runpath}` : null
        ].filter(Boolean).join('\n') || 'ok',
        inline: false
      });
    }

    await message.reply({ embeds: [embed] });
  }
};
