import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { EmbedBuilder } from 'discord.js';
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
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

export const prefixCommand: PrefixCommand = {
  trigger: 'elfcheck',
  description: 'Checagem ELF (headers, program headers, dynamic, symbols). Uso: ;elfcheck <caminho|url|anexo>',
  async execute(message: Message, args: string[]) {
    const baseDir = path.resolve(process.cwd(), 'triage');
    await ensureDir(baseDir);

    let filePath: string | null = null;

    const att = message.attachments.first();
    if (att) {
      const safeName = (att.name || 'upload.elf').replace(/[^a-zA-Z0-9._-]/g, '_');
      filePath = path.join(baseDir, `${Date.now()}_${safeName}`);
      try {
        await downloadTo(att.url, filePath);
      } catch (e: any) {
        await message.reply(`Falha ao baixar anexo: ${e?.message || e}`);
        return;
      }
    } else {
      const target = args.join(' ').trim();
      if (!target) {
        await message.reply('Uso: `;elfcheck <caminho|url>` ou envie um anexo com `;elfcheck`');
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
      }
    }

    const q = shQuote(filePath);

    let fileOut = '';
    try {
      const { stdout } = await exec(`bash -lc "file -b ${q}"`);
      fileOut = stdout.trim();
    } catch {}

    if (!/ELF/i.test(fileOut)) {
      await message.reply(`Isso não parece ELF: \`${fileOut || 'n/a'}\``);
      return;
    }

    const blocks: string[] = [];

    try {
      const { stdout } = await exec(`bash -lc "readelf -h ${q} 2>/dev/null | head -n 60"`);
      blocks.push('== ELF HEADER ==\n' + stdout.trim());
    } catch {}

    try {
      const { stdout } = await exec(`bash -lc "readelf -l ${q} 2>/dev/null | head -n 120"`);
      blocks.push('== PROGRAM HEADERS ==\n' + stdout.trim());
    } catch {}

    try {
      const { stdout } = await exec(`bash -lc "readelf -d ${q} 2>/dev/null | head -n 120"`);
      blocks.push('== DYNAMIC ==\n' + stdout.trim());
    } catch {}

    try {
      const { stdout } = await exec(`bash -lc "readelf -s ${q} 2>/dev/null | head -n 120"`);
      blocks.push('== SYMBOLS (head) ==\n' + stdout.trim());
    } catch {}

    const report = blocks.join('\n\n').trim();
    const chunk = report.length > 3500 ? report.slice(0, 3500) + '\n...[truncado]' : report;

    const embed = new EmbedBuilder()
      .setTitle('ELF Check')
      .setColor(0x222222)
      .setDescription(`\`file\`: ${fileOut || 'n/a'}\n\n\`report\` (resumo):`);

    await message.reply({ embeds: [embed], content: '```\n' + chunk + '\n```' });
  }
};
