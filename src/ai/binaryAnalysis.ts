import { logger } from "../utils/logger.js";

export interface PEReport {
  valid: boolean;
  error?: string;
  fileInfo: {
    size: number;
    type: "EXE" | "DLL" | "SYS" | "DRIVER" | "PE";
  };
  dosHeader?: {
    magic: string;
    peOffset: number;
  };
  peHeader?: {
    machine: string;
    sections: number;
    timestamp: string;
    characteristics: string[];
  };
  optionalHeader?: {
    magic: string;
    subsystem: string;
    imageBase: string;
    entryPoint: string;
    linkerVersion: string;
    sizeOfImage: string;
  };
  sections: Array<{
    name: string;
    virtualAddress: string;
    virtualSize: string;
    rawSize: string;
    characteristics: string;
  }>;
  imports: Array<{
    dll: string;
    functions: string[];
  }>;
  strings: string[];
}

const MACHINES: Record<number, string> = {
  0x0000: "Unknown",
  0x014C: "x86 (i386)",
  0x0200: "IA64",
  0x8664: "x86-64 (AMD64)",
  0x01C0: "ARM",
  0x01C4: "ARMv7 Thumb-2",
  0xAA64: "ARM64",
  0x0EBC: "EFI Bytecode",
};

const SUBSYSTEMS: Record<number, string> = {
  0: "Unknown",
  1: "Native",
  2: "Windows GUI",
  3: "Windows Console (CUI)",
  5: "OS/2 Console",
  7: "POSIX Console",
  9: "Windows CE",
  10: "EFI Application",
  11: "EFI Boot Service Driver",
  12: "EFI Runtime Driver",
  14: "Xbox",
  16: "Windows Boot Application",
};

const SECTION_FLAGS: Array<[number, string]> = [
  [0x00000020, "CODE"],
  [0x00000040, "INITIALIZED_DATA"],
  [0x00000080, "UNINITIALIZED_DATA"],
  [0x02000000, "DISCARDABLE"],
  [0x04000000, "NO_CACHE"],
  [0x08000000, "NO_PAGE"],
  [0x10000000, "SHARED"],
  [0x20000000, "EXECUTE"],
  [0x40000000, "READ"],
  [0x80000000, "WRITE"],
];

const CHAR_FLAGS: Array<[number, string]> = [
  [0x0001, "RELOCS_STRIPPED"],
  [0x0002, "EXECUTABLE_IMAGE"],
  [0x0004, "LINE_NUMS_STRIPPED"],
  [0x0008, "LOCAL_SYMS_STRIPPED"],
  [0x0020, "LARGE_ADDRESS_AWARE"],
  [0x0100, "32BIT_MACHINE"],
  [0x0200, "DEBUG_STRIPPED"],
  [0x1000, "SYSTEM"],
  [0x2000, "DLL"],
  [0x4000, "UNIPROCESSOR_ONLY"],
];

function readUint16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

function readUint32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

function readString(buf: Buffer, offset: number, maxLen = 8): string {
  let end = offset;
  while (end < offset + maxLen && end < buf.length && buf[end] !== 0) end++;
  return buf.subarray(offset, end).toString("ascii");
}

function readCString(buf: Buffer, offset: number): string {
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  return buf.subarray(offset, end).toString("ascii");
}

function rvaToOffset(rva: number, sections: Array<{ va: number; rawOffset: number; rawSize: number }>): number {
  for (const sec of sections) {
    if (rva >= sec.va && rva < sec.va + sec.rawSize) {
      return sec.rawOffset + (rva - sec.va);
    }
  }
  return -1;
}

export function parsePE(data: Buffer): PEReport {
  const report: PEReport = {
    valid: false,
    fileInfo: { size: data.length, type: "PE" },
    sections: [],
    imports: [],
    strings: [],
  };

  if (data.length < 64) {
    report.error = "Arquivo muito pequeno para ser um PE válido.";
    return report;
  }

  // DOS header
  const dosMagic = data.subarray(0, 2).toString("ascii");
  if (dosMagic !== "MZ") {
    report.error = "Assinatura MZ não encontrada — não é um PE válido.";
    return report;
  }

  const peOffset = readUint32LE(data, 0x3C);
  report.dosHeader = { magic: "MZ", peOffset };

  if (peOffset + 4 > data.length) {
    report.error = "Offset do PE fora dos limites do arquivo.";
    return report;
  }

  // PE signature
  const peSig = data.subarray(peOffset, peOffset + 4).toString("ascii");
  if (peSig !== "PE\0\0") {
    report.error = `Assinatura PE inválida: ${JSON.stringify(peSig)}`;
    return report;
  }

  // COFF header
  const coffOffset = peOffset + 4;
  if (coffOffset + 20 > data.length) {
    report.error = "Arquivo truncado no COFF header.";
    return report;
  }

  const machine = readUint16LE(data, coffOffset);
  const numSections = readUint16LE(data, coffOffset + 2);
  const timestamp = readUint32LE(data, coffOffset + 4);
  const optionalHeaderSize = readUint16LE(data, coffOffset + 16);
  const characteristics = readUint16LE(data, coffOffset + 18);

  const charFlags = CHAR_FLAGS.filter(([flag]) => characteristics & flag).map(([, name]) => name);
  const isDLL = !!(characteristics & 0x2000);
  const isEXE = !!(characteristics & 0x0002) && !isDLL;

  if (isDLL) report.fileInfo.type = "DLL";
  else if (isEXE) report.fileInfo.type = "EXE";

  const tsDate = new Date(timestamp * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";

  report.peHeader = {
    machine: MACHINES[machine] || `0x${machine.toString(16).toUpperCase()}`,
    sections: numSections,
    timestamp: tsDate,
    characteristics: charFlags,
  };

  // Optional header
  const optOffset = coffOffset + 20;
  let subsystem = 0;
  let imageBase = BigInt(0);
  let entryPoint = 0;
  let importDirRVA = 0;
  let importDirSize = 0;
  let magic = 0;
  let majorLinker = 0;
  let minorLinker = 0;
  let sizeOfImage = 0;

  if (optionalHeaderSize >= 28 && optOffset + 4 <= data.length) {
    magic = readUint16LE(data, optOffset);
    majorLinker = data[optOffset + 2];
    minorLinker = data[optOffset + 3];
    entryPoint = readUint32LE(data, optOffset + 16);
    const magicStr = magic === 0x10b ? "PE32 (32-bit)" : magic === 0x20b ? "PE32+ (64-bit)" : `0x${magic.toString(16)}`;

    if (magic === 0x10b && optOffset + 96 <= data.length) {
      imageBase = BigInt(readUint32LE(data, optOffset + 28));
      subsystem = readUint16LE(data, optOffset + 68);
      sizeOfImage = readUint32LE(data, optOffset + 56);
      importDirRVA = readUint32LE(data, optOffset + 104);
      importDirSize = readUint32LE(data, optOffset + 108);
    } else if (magic === 0x20b && optOffset + 112 <= data.length) {
      imageBase = data.readBigUInt64LE(optOffset + 24);
      subsystem = readUint16LE(data, optOffset + 68);
      sizeOfImage = readUint32LE(data, optOffset + 56);
      importDirRVA = readUint32LE(data, optOffset + 120);
      importDirSize = readUint32LE(data, optOffset + 124);
    }

    report.optionalHeader = {
      magic: magicStr,
      subsystem: SUBSYSTEMS[subsystem] || `${subsystem}`,
      imageBase: `0x${imageBase.toString(16).toUpperCase()}`,
      entryPoint: `0x${entryPoint.toString(16).toUpperCase()}`,
      linkerVersion: `${majorLinker}.${minorLinker}`,
      sizeOfImage: `${(sizeOfImage / 1024).toFixed(1)} KB`,
    };

    // Detect SYS/DRIVER
    if (subsystem === 1 || subsystem === 11 || subsystem === 12) {
      report.fileInfo.type = "DRIVER";
    }
  }

  // Sections
  const sectionTableOffset = optOffset + optionalHeaderSize;
  const rawSections: Array<{ va: number; rawOffset: number; rawSize: number }> = [];

  for (let i = 0; i < numSections && i < 96; i++) {
    const secOffset = sectionTableOffset + i * 40;
    if (secOffset + 40 > data.length) break;

    const name = readString(data, secOffset, 8);
    const virtualSize = readUint32LE(data, secOffset + 8);
    const virtualAddress = readUint32LE(data, secOffset + 12);
    const rawDataSize = readUint32LE(data, secOffset + 16);
    const rawDataOffset = readUint32LE(data, secOffset + 20);
    const secCharacteristics = readUint32LE(data, secOffset + 36);

    rawSections.push({ va: virtualAddress, rawOffset: rawDataOffset, rawSize: rawDataSize });

    const secFlags = SECTION_FLAGS
      .filter(([flag]) => secCharacteristics & flag)
      .map(([, n]) => n)
      .join(" | ");

    report.sections.push({
      name: name || "(unnamed)",
      virtualAddress: `0x${virtualAddress.toString(16).toUpperCase()}`,
      virtualSize: `${virtualSize} bytes`,
      rawSize: `${rawDataSize} bytes`,
      characteristics: secFlags || `0x${secCharacteristics.toString(16)}`,
    });
  }

  // Import table
  if (importDirRVA && importDirSize) {
    const importOffset = rvaToOffset(importDirRVA, rawSections);
    if (importOffset > 0) {
      let pos = importOffset;
      while (pos + 20 <= data.length) {
        const iltRVA = readUint32LE(data, pos);
        const nameRVA = readUint32LE(data, pos + 12);
        const iatRVA = readUint32LE(data, pos + 16);

        if (iltRVA === 0 && nameRVA === 0 && iatRVA === 0) break;

        const dllNameOffset = rvaToOffset(nameRVA, rawSections);
        const dllName = dllNameOffset > 0 ? readCString(data, dllNameOffset) : "(unknown)";

        const functions: string[] = [];
        const lookupRVA = iltRVA || iatRVA;
        const lookupOffset = rvaToOffset(lookupRVA, rawSections);

        if (lookupOffset > 0) {
          const is64 = magic === 0x20b;
          let thunkPos = lookupOffset;

          while (thunkPos + (is64 ? 8 : 4) <= data.length && functions.length < 50) {
            const thunk = is64
              ? Number(data.readBigUInt64LE(thunkPos) & BigInt(0xFFFFFFFF))
              : readUint32LE(data, thunkPos);

            if (thunk === 0) break;

            const isOrdinal = is64
              ? !!(data.readBigUInt64LE(thunkPos) & BigInt("0x8000000000000000"))
              : !!(thunk & 0x80000000);

            if (isOrdinal) {
              functions.push(`Ordinal#${thunk & 0xFFFF}`);
            } else {
              const nameOffset = rvaToOffset(thunk, rawSections);
              if (nameOffset > 0 && nameOffset + 2 < data.length) {
                const fname = readCString(data, nameOffset + 2);
                if (fname) functions.push(fname);
              }
            }
            thunkPos += is64 ? 8 : 4;
          }
        }

        if (dllName) {
          report.imports.push({ dll: dllName, functions });
        }

        pos += 20;
        if (report.imports.length > 64) break;
      }
    }
  }

  // Extract strings (printable ASCII >= 4 chars)
  const MIN_LEN = 4;
  const MAX_STRINGS = 200;
  let current = "";
  const stringsSet = new Set<string>();

  for (let i = 0; i < data.length && stringsSet.size < MAX_STRINGS; i++) {
    const ch = data[i];
    if (ch >= 0x20 && ch <= 0x7E) {
      current += String.fromCharCode(ch);
    } else {
      if (current.length >= MIN_LEN) stringsSet.add(current);
      current = "";
    }
  }
  if (current.length >= MIN_LEN) stringsSet.add(current);

  // Filter out very common/boring strings
  report.strings = [...stringsSet]
    .filter(s => !/^[\s\-=!*]+$/.test(s))
    .slice(0, 150);

  report.valid = true;
  return report;
}

export function formatPEReport(report: PEReport, filename: string): string {
  if (!report.valid) {
    return `**Análise de Binário — ${filename}**\n\n❌ ${report.error}`;
  }

  const lines: string[] = [];
  lines.push(`**Análise PE — ${filename}**`);
  lines.push(`Tipo: \`${report.fileInfo.type}\` | Tamanho: \`${(report.fileInfo.size / 1024).toFixed(1)} KB\``);
  lines.push("");

  if (report.peHeader) {
    lines.push("**[COFF Header]**");
    lines.push(`Arquitetura: \`${report.peHeader.machine}\``);
    lines.push(`Seções: \`${report.peHeader.sections}\``);
    lines.push(`Compilado em: \`${report.peHeader.timestamp}\``);
    if (report.peHeader.characteristics.length > 0) {
      lines.push(`Flags: \`${report.peHeader.characteristics.join(" | ")}\``);
    }
    lines.push("");
  }

  if (report.optionalHeader) {
    lines.push("**[Optional Header]**");
    lines.push(`Formato: \`${report.optionalHeader.magic}\``);
    lines.push(`Subsistema: \`${report.optionalHeader.subsystem}\``);
    lines.push(`Image Base: \`${report.optionalHeader.imageBase}\``);
    lines.push(`Entry Point: \`${report.optionalHeader.entryPoint}\``);
    lines.push(`Linker: \`${report.optionalHeader.linkerVersion}\``);
    lines.push(`Tamanho da imagem: \`${report.optionalHeader.sizeOfImage}\``);
    lines.push("");
  }

  if (report.sections.length > 0) {
    lines.push("**[Seções]**");
    for (const sec of report.sections) {
      lines.push(`\`${sec.name.padEnd(8)}\` VA=${sec.virtualAddress} raw=${sec.rawSize} [${sec.characteristics}]`);
    }
    lines.push("");
  }

  if (report.imports.length > 0) {
    lines.push("**[Imports]**");
    for (const imp of report.imports) {
      const fnList = imp.functions.slice(0, 12).join(", ");
      const more = imp.functions.length > 12 ? ` +${imp.functions.length - 12} mais` : "";
      lines.push(`\`${imp.dll}\`: ${fnList}${more}`);
    }
    lines.push("");
  } else {
    lines.push("**[Imports]** Nenhum encontrado / tabela de imports vazia.");
    lines.push("");
  }

  return lines.join("\n");
}

export function buildStringsAttachment(report: PEReport): string {
  if (report.strings.length === 0) return "Nenhuma string encontrada.";
  return `=== Strings extraídas (${report.strings.length}) ===\n\n` + report.strings.join("\n");
}

export async function downloadAndParsePE(url: string): Promise<PEReport> {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  logger.info({ size: buf.length }, "Binário baixado para análise PE");
  return parsePE(buf);
}

export function isPEFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ["exe", "dll", "sys", "drv", "ocx", "scr", "cpl", "efi"].includes(ext);
}
