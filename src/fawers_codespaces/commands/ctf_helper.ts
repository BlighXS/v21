import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const HELP: Record<string, string> = {
  rev: `# CTF REV Checklist\n- \`file\`, \`strings\`, \`checksec\` (se ELF), \`pecheck\` (se PE)\n- Detectar packer: entropy alta, seções RWX, UPX, overlays\n- Rodar em sandbox local: strace/ltrace (ELF), ProcMon (Win)\n- Encontrar decode routines (XOR/RC4/AES), tabelas e chaves\n- Patches: NOP em checks, alterar branches\n- Extrair flag: fluxo de validação, comparações, transformações\n`,
  pwn: `# CTF PWN Checklist\n- \`checksec\` / mitigations (NX/PIE/CANARY/RELRO)\n- Surface: input parsing, format strings, heap, UAF\n- Fuzz básico: inputs curtos → longos, patterns\n- Leak primeiro (ASLR), depois control-flow\n- ROP/SROP quando NX, GOT/PLT quando RELRO parcial\n`,
  web: `# CTF WEB Checklist\n- Recon: rotas, parâmetros, headers, cookies\n- Auth: JWT, sessões, reset password, IDOR\n- Injeções: SQLi, SSTI, command injection, SSRF\n- Upload: polyglot, path traversal, mime bypass\n- LFI/RFI, deserialização, cache poisoning\n`,
  crypto: `# CTF CRYPTO Checklist\n- Identificar esquema: XOR, Vigenere, RSA, ECC, AES mode\n- Verificar reuse de nonce/IV, padding oracle, ECB\n- RSA: small e, common modulus, CRT leaks, weak primes\n- Hash: length extension, collisions (em CTF), HMAC misuse\n`,
  forensics: `# CTF FORENSICS Checklist\n- File carving: binwalk, foremost\n- Metadados: exiftool\n- PCAP: tshark/wireshark, streams\n- Stego: strings, zsteg, stegsolve\n- Logs: timeline e correlação\n`,
  misc: `# CTF MISC Checklist\n- Leia o enunciado 2x, procure constraints\n- Automação: scripts rápidos (python)\n- Encoding/compress: base64, gzip, xz, zip\n- APIs rate-limit, brute logic, parsing\n`
};

export const prefixCommand: PrefixCommand = {
  trigger: 'ctf-helper',
  description: 'Checklist/hints por categoria. Uso: ;ctf-helper <rev|pwn|web|crypto|forensics|misc>',
  async execute(message: Message, args: string[]) {
    const cat = (args[0] || '').toLowerCase();
    if (!cat || !HELP[cat]) {
      await message.reply('Uso: `;ctf-helper <rev|pwn|web|crypto|forensics|misc>`');
      return;
    }
    await message.reply('```\n' + HELP[cat] + '\n```');
  }
};
