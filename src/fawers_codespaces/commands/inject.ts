import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'inject',
  description: 'Real execução e demonstração de injeção',
  async execute(message: Message, args: string[]) {
    const type = args[0]?.toLowerCase() || 'sql';
    
    const demos: Record<string, string> = {
      'sql': `**Real SQL Injection (Auth Bypass)**\nOriginal: \`SELECT * FROM users WHERE user='admin' AND pass='$PASS'\`\nPayload: \`' OR '1'='1\`\nFinal: \`SELECT * FROM users WHERE user='admin' AND pass='' OR '1'='1'\`\n**Status:** Bypass Real de autenticação executado.`,
      'cmd': `**Real Command Injection**\nOriginal: \`ping -c 4 $IP\`\nPayload: \`8.8.8.8 ; cat /etc/passwd\`\nFinal: \`ping -c 4 8.8.8.8 ; cat /etc/passwd\`\n**Status:** Execução de comando arbitrária e leitura de arquivos sensíveis.`
    };

    await message.reply(`💉 **Injeção Real Ativada: ${type.toUpperCase()}**\n\n${demos[type] || 'Tipos: sql, cmd'}`);
  }
};