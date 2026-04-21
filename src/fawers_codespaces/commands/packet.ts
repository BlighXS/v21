import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'packet',
  description: 'Explica a estrutura de um pacote de rede na prática',
  async execute(message: Message, args: string[]) {
    const type = args[0]?.toUpperCase() || 'TCP/IP';
    
    const response = `📦 **Anatomia de um Pacote: ${type}**\n\n` +
      `\`[ Ethernet Header | IP Header | TCP Header | Data/Payload | FCS ]\`\n\n` +
      `• **SYN**: Pedido de sincronização (Início do 3-way handshake).\n` +
      `• **ACK**: Confirmação de recebimento.\n` +
      `• **Sequence Number**: Garante que os dados cheguem na ordem correta.\n` +
      `• **TTL**: Tempo de vida (evita que o pacote circule infinitamente).`;

    await message.reply(response);
  }
};