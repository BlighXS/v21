import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const exec = promisify(_exec);

function shQuote(p: string) {
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function downloadTo(url: string, outPath: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
}

function sanitizeRuleName(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1').slice(0, 64) || 'faw_rule';
}

function pickStrings(lines: string[], max = 20) {
  const picked: string[] = [];
  for (const l of lines) {
    const s = l.trim();
    if (!s) continue;
    if (s.length < 8) continue;
    if (s.length > 80) continue;
    if (/^\s*$/.test(s)) continue;
    if (/^[0-9a-f]{32,}$/i.test(s)) continue;
    if (/^https?:\/\//i.test(s)) {
      // keep a few urls
      picked.push(s);
      continue;
    }
    picked.push(s);
    if (picked.length >= max) break;
  }
  // dedupe
  return Array.from(new Set(picked));
}

export const prefixCommand: PrefixCommand = {
  trigger: 'yara-gen',
  description: 'Gera uma regra YARA simples a partir de strings do binário. Uso: ;yara-gen <caminho|url|anexo> [nome_regra]',
  async execute(message: Message, args: string[]) {
    const baseDir = path.resolve(process.cwd(), 'triage');
    await ensureDir(baseDir);

    let filePath: string | null = null;
    let ruleName = sanitizeRuleName(args[1] || 'faw_sample');

    const att = message.attachments.first();
    if (att) {
      const safeName = (att.name || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
      filePath = path.join(baseDir, `${Date.now()}_${safeName}`);
      ruleName = sanitizeRuleName(path.parse(safeName).name);
      try {
        await downloadTo(att.url, filePath);
      } catch (e: any) {
        await message.reply(`Falha ao baixar anexo: ${e?.message || e}`);
        return;
      }
    } else {
      const target = (args[0] || '').trim();
      if (!target) {
        await message.reply('Uso: `;yara-gen <caminho|url>` ou envie um anexo com `;yara-gen`');
        return;
      }
      if (/^https?:\/\//i.test(target)) {
        filePath = path.join(baseDir, `url_${Date.now()}.bin`);
        try {
          await downloadTo(target, filePath);
        } catch (e: any) {
          await message.reply(`Falha ao baixar URL: ${e?.message || e}`);
          return;
        }
      } else {
        filePath = path.resolve(process.cwd(), target);
        ruleName = sanitizeRuleName(path.parse(target).name);
      }

      if (args[1]) ruleName = sanitizeRuleName(args[1]);
    }

    const q = shQuote(filePath);

    let strs: string[] = [];
    try {
      const { stdout } = await exec(`bash -lc "strings -a -n 6 ${q} | head -n 400"`);
      strs = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    } catch {
      await message.reply('Falha ao extrair strings.');
      return;
    }

    const picked = pickStrings(strs, 24);
    if (!picked.length) {
      await message.reply('Não achei strings boas pra gerar regra.');
      return;
    }

    const meta = {
      author: 'FAW',
      generated_by: 'Fawers',
      date: new Date().toISOString()
    };

    const stringsBlock = picked
      .map((s, i) => {
        const id = `$s${String(i + 1).padStart(2, '0')}`;
        const escaped = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `    ${id} = "${escaped}" ascii nocase`;
      })
      .join('\n');

    const yara = `rule ${ruleName}\n{\n  meta:\n    author = \"${meta.author}\"\n    generated_by = \"${meta.generated_by}\"\n    date = \"${meta.date}\"\n\n  strings:\n${stringsBlock}\n\n  condition:\n    uint16(0) == 0x5A4D or uint32(0) == 0x464C457F or any of them\n}\n`;

    const outPath = path.join(baseDir, `${ruleName}.yara`);
    await writeFile(outPath, yara);

    const embed = new EmbedBuilder()
      .setTitle('YARA Gen')
      .setColor(0x222222)
      .setDescription(`Regra gerada: \`${ruleName}\`\nStrings: ${picked.length}\nArquivo: \`${outPath}\``);

    const file = new AttachmentBuilder(Buffer.from(yara, 'utf-8'), { name: `${ruleName}.yara` });
    await message.reply({ embeds: [embed], files: [file] });
  }
};
