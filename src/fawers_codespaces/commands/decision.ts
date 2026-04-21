import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const DILEMMAS = [
  {
    q: 'Você encontrou uma chave SSH sem senha no servidor web.',
    a: 'A) Tentar pivotar imediatamente para o servidor de backup.\nB) Limpar os logs e esperar para ver se há tráfego administrativo.'
  },
  {
    q: 'O firewall bloqueia todas as saídas, exceto DNS (porta 53).',
    a: 'A) Tentar um túnel DNS para exfiltração lenta.\nB) Tentar um bypass de regras de firewall via ICMP.'
  }
];

export const prefixCommand: PrefixCommand = {
  trigger: 'decision',
  description: 'Apresenta um cenário e força uma escolha tática',
  async execute(message: Message) {
    const d = DILEMMAS[Math.floor(Math.random() * DILEMMAS.length)];
    await message.reply(`⚖️ **DILEMA OPERACIONAL:**\n\n**Cenário:** ${d.q}\n\n**Escolha seu caminho:**\n${d.a}`);
  }
};