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

async function cmdExists(cmd: string): Promise<boolean> {
  try {
    await exec(`bash -lc "command -v ${cmd} >/dev/null 2>&1"`);
    return true;
  } catch {
    return false;
  }
}

export const prefixCommand: PrefixCommand = {
  trigger: 'pecheck',
  description: 'Checagem PE (headers/sections/imports). Uso: ;pecheck <caminho|url|anexo>',
  async execute(message: Message, args: string[]) {
    const baseDir = path.resolve(process.cwd(), 'triage');
    await ensureDir(baseDir);

    let filePath: string | null = null;

    const att = message.attachments.first();
    if (att) {
      const safeName = (att.name || 'upload.exe').replace(/[^a-zA-Z0-9._-]/g, '_');
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
        await message.reply('Uso: `;pecheck <caminho|url>` ou envie um anexo com `;pecheck`');
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

    const havePefile = await cmdExists('pefile');
    if (!havePefile) {
      // install lightweight dependency
      try {
        await exec(`bash -lc "python3 -m pip -q install --user pefile >/dev/null 2>&1 || true"`);
      } catch {}
    }

    const q = shQuote(filePath);

    let fileOut = '';
    try {
      const { stdout } = await exec(`bash -lc "file -b ${q}"`);
      fileOut = stdout.trim();
    } catch {}

    if (!/PE32|MS-DOS executable/i.test(fileOut)) {
      await message.reply(`Isso não parece PE: \`${fileOut || 'n/a'}\``);
      return;
    }

    let report = '';
    try {
      const { stdout } = await exec(
        `bash -lc "python3 - <<'PY'\nimport pefile,sys,math\npath=${JSON.stringify(filePath)}\npe=pefile.PE(path)\nprint('Machine',hex(pe.FILE_HEADER.Machine))\nprint('NumberOfSections',pe.FILE_HEADER.NumberOfSections)\nprint('TimeDateStamp',pe.FILE_HEADER.TimeDateStamp)\nprint('Characteristics',hex(pe.FILE_HEADER.Characteristics))\nprint('Subsystem',pe.OPTIONAL_HEADER.Subsystem)\nprint('DllCharacteristics',hex(pe.OPTIONAL_HEADER.DllCharacteristics))\nprint('ImageBase',hex(pe.OPTIONAL_HEADER.ImageBase))\nprint('EntryPoint',hex(pe.OPTIONAL_HEADER.AddressOfEntryPoint))\ntry:\n  print('Imphash',pe.get_imphash())\nexcept Exception:\n  pass\n# sections\nprint('Sections:')\nfor s in pe.sections:\n  name=s.Name.rstrip(b'\\x00').decode(errors='ignore') or '<noname>'\n  vs=s.Misc_VirtualSize\n  rs=s.SizeOfRawData\n  ch=s.Characteristics\n  exec_flag=bool(ch & 0x20000000)\n  write_flag=bool(ch & 0x80000000)\n  read_flag=bool(ch & 0x40000000)\n  tag=('R' if read_flag else '-')+('W' if write_flag else '-')+('X' if exec_flag else '-')\n  print(f'  {name:10} raw={rs:8} vsize={vs:8} {tag} ch={hex(ch)}')\n# imports\nprint('Imports:')\ntry:\n  pe.parse_data_directories(directories=[pefile.DIRECTORY_ENTRY[\"IMAGE_DIRECTORY_ENTRY_IMPORT\"]])\n  for entry in getattr(pe,'DIRECTORY_ENTRY_IMPORT',[]):\n    dll=entry.dll.decode(errors='ignore')\n    funcs=[]\n    for imp in entry.imports[:12]:\n      if imp.name:\n        funcs.append(imp.name.decode(errors='ignore'))\n      else:\n        funcs.append(f'ord:{imp.ordinal}')\n    print('  '+dll+': '+', '.join(funcs))\nexcept Exception as e:\n  print('  (falha imports)',e)\nPY"`
      );
      report = stdout.trim();
    } catch (e: any) {
      await message.reply(`Falha ao analisar PE: ${e?.message || e}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('PE Check')
      .setColor(0x222222)
      .setDescription(`\`file\`: ${fileOut || 'n/a'}\n\n\`report\` (resumo):`);

    const chunk = report.length > 3500 ? report.slice(0, 3500) + '\n...[truncado]' : report;
    await message.reply({ embeds: [embed], content: '```\n' + chunk + '\n```' });
  }
};
