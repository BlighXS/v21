import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const PORTS: Record<string, string> = {
  'ftp': '21 (TCP)', 'ssh': '22 (TCP)', 'telnet': '23 (TCP)',
  'smtp': '25/465/587 (TCP)', 'dns': '53 (UDP/TCP)',
  'http': '80 (TCP)', 'pop3': '110/995 (TCP)',
  'rpcbind': '111 (TCP/UDP)', 'ntp': '123 (UDP)',
  'imap': '143/993 (TCP)', 'snmp': '161/162 (UDP)',
  'ldap': '389/636 (TCP)', 'https': '443 (TCP)',
  'smb': '445 (TCP)', 'mssql': '1433 (TCP)',
  'mysql': '3306 (TCP)', 'rdp': '3389 (TCP/UDP)',
  'postgresql': '5432 (TCP)', 'redis': '6379 (TCP)',
  'mongodb': '27017 (TCP)'
};

export const prefixCommand: PrefixCommand = {
  trigger: 'ports',
  description: 'Consulta portas comuns de serviços',
  async execute(message: Message, args: string[]) {
    const service = args[0]?.toLowerCase();
    if (!service) return message.reply(`Portas mapeadas: ${Object.keys(PORTS).join(', ')}`);
    const port = PORTS[service];
    if (!port) return message.reply('❌ Serviço não encontrado.');
    await message.reply(`🔌 **${service.toUpperCase()}** utiliza a porta: **${port}**`);
  }
};