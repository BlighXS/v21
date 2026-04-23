import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'ida-notes',
  description: 'Template de notas/checklist para IDA. Uso: ;ida-notes',
  async execute(message: Message) {
    const tpl = `# IDA Notes (FAW)\n\n## 0) Arquivo\n- Nome: \n- Hashes (SHA256/MD5): \n- Tipo: PE/ELF/Mach-O/Script\n\n## 1) Visão rápida\n- Entry point: \n- Compiler/Toolchain: \n- Indicadores de packer/obfuscation: \n\n## 2) Imports / APIs\n- Crypto: Crypt*, BCrypt*, libsodium, mbedTLS\n- Network: WinHTTP/WinINet/WS2_32, libcurl\n- Process/Injection: OpenProcess/WriteProcessMemory/CreateRemoteThread\n- Persistence: Reg*, Task Scheduler, Services\n\n## 3) Strings\n- URLs/domínios: \n- User-Agent: \n- Paths suspeitos: \n- Chaves/segredos: \n\n## 4) Config\n- Estrutura de config (offsets/keys): \n- Encryption (alg/chave/IV): \n\n## 5) Fluxo\n- Funções principais:\n  - main:\n  - init:\n  - net:\n  - crypto:\n- IOC points:\n\n## 6) IOCs\n- Domínios/IPs: \n- Paths/Mutexes: \n- Registry keys: \n- Filenames: \n\n## 7) Patches/Bypass\n- Anti-debug: \n- VM checks: \n- License checks: \n\n## 8) Resultado\n- Comportamento resumido:\n- YARA/IOCs:\n- Próximos passos:\n`;

    await message.reply('```\n' + tpl + '\n```');
  }
};
