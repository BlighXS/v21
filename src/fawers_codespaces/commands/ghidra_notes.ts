import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'ghidra-notes',
  description: 'Template de notas/checklist para Ghidra. Uso: ;ghidra-notes',
  async execute(message: Message) {
    const tpl = `# GHIDRA Notes (FAW)\n\n## 0) Setup\n- Processor/Language selecionado: \n- Base address/loader options: \n- Auto-analysis options: \n\n## 1) Navegação\n- Entry point: \n- Functions de alto nível: \n- Callgraph insights: \n\n## 2) Data types / structs\n- Structs de config: \n- Vtables/classes (C++): \n- Enums relevantes: \n\n## 3) Strings / Resources\n- Strings-chave: \n- Recursos/RCData: \n\n## 4) Deobfuscation\n- XOR/RC4/AES patterns: \n- Decode routine: \n\n## 5) IOCs\n- Domínios/IPs: \n- Mutexes/paths/registry: \n\n## 6) Patch plan\n- Checks a neutralizar: \n- Locais (addr/symbol): \n\n## 7) Resultado\n- Resumo:\n- Artefatos gerados:\n`;

    await message.reply('```\n' + tpl + '\n```');
  }
};
