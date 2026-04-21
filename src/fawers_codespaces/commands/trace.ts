import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'trace',
  description: 'Real trace de ataque e fluxo de invasão',
  async execute(message: Message, args: string[]) {
    const type = args[0]?.toLowerCase();
    if (!type) return message.reply('Uso: `;trace <sqli|rce|privesc>`');

    const traces: Record<string, string> = {
      'sqli': '1. Recon: Mapeamento de endpoints.\n2. Injection: Quebra de query SQL.\n3. Enumeration: Extração de tabelas e colunas.\n4. Exfiltration: Dump de banco de dados real.',
      'privesc': '1. Entry: Acesso via shell de baixa permissão.\n2. Enumeration: Identificação de Kernel desatualizado ou binários SUID.\n3. Exploitation: Execução de exploit local.\n4. Root: Ganho de privilégios máximos.',
      'rce': '1. Discovery: Identificação de entrada não sanitizada.\n2. Payload: Injeção de reverse shell.\n3. Execution: Execução de comando remota.\n4. Access: Estabelecimento de sessão interativa.'
    };

    const flow = traces[type] || 'Tente: sqli, privesc ou rce.';
    await message.reply(`🛤️ **Real Attack Trace: ${type.toUpperCase()}**\n\n${flow}`);
  }
};