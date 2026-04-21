import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'sysmap',
  description: 'Mostra a arquitetura simplificada do sistema',
  async execute(message: Message) {
    const map = `🗺️ **Mapa Mental da Arquitetura**\n\`\`\`\n` +
      `[ USUÁRIO ] -> [ APLICAÇÃO ]\n` +
      `      |             |\n` +
      `      v             v\n` +
      `[ SYSCALLS ] <-> [ KERNEL ]\n` +
      `      |             |\n` +
      `      +-------------+---- [ PROCESSOS/THREADS ]\n` +
      `      |             |\n` +
      `      v             v\n` +
      `[ CPU (ALU/Regs) ] [ RAM (Heap/Stack) ]\n` +
      `\`\`\`\n` +
      `• **Processo**: Instância de um programa em execução.\n` +
      `• **Thread**: Unidade básica de utilização da CPU dentro de um processo.`;
    
    await message.reply(map);
  }
};