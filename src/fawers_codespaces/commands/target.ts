import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'target',
  description: 'Gera um alvo real para treinamento de invasão',
  async execute(message: Message) {
    const targets = [
      { ip: '192.168.1.45', os: 'Ubuntu 18.04', services: 'HTTP (80), SSH (22), MySQL (3306)' },
      { ip: '10.0.0.12', os: 'Windows Server 2012 R2', services: 'RDP (3389), SMB (445), IIS (80)' },
      { ip: '172.16.254.10', os: 'CentOS 7', services: 'FTP (21), SMTP (25), HTTP (8080)' }
    ];

    const t = targets[Math.floor(Math.random() * targets.length)];
    
    const scenario = `🎯 **ALVO REAL DETECTADO**\n` +
      `• **Endereço**: \`${t.ip}\`\n` +
      `• **S.O.**: ${t.os}\n` +
      `• **Portas Abertas**: ${t.services}\n\n` +
      `**Missão:** Execute o mapeamento de vulnerabilidades e obtenha persistência no sistema.`;

    await message.reply(scenario);
  }
};