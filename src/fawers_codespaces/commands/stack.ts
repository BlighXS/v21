import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'stack',
  description: 'Exibe e explica um Stack Trace para fins educacionais',
  async execute(message: Message) {
    const trace = `💥 **STACK TRACE ANALYSIS (Memory Dump)**\n\n` +
      `\`\`\`\n` +
      `0x004010a5: segmentation fault at address 0x00000000\n` +
      `at main (main.c:25)\n` +
      `at __libc_start_main (libc.so.6)\n` +
      `\`\`\`\n\n` +
      `**O que aconteceu?**\n` +
      `1. **Stack Frame**: Cada função chamada cria um quadro na pilha.\n` +
      `2. **Pointer**: O programa tentou ler o endereço \`0x0\` (NULL Pointer).\n` +
      `3. **Segfault**: O Kernel interrompeu o processo porque ele tentou acessar memória que não lhe pertencia.`;

    await message.reply(trace);
  }
};