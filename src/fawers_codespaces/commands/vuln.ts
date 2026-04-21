import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const VULNS: Record<string, string> = {
  'sqli': '**SQL Injection:** Injeção de comandos SQL em campos de input para manipular o banco de dados. Pode levar a vazamento de dados ou bypass de login.',
  'xss': '**Cross-Site Scripting:** Injeção de scripts maliciosos (JS) que rodam no navegador de outros usuários. Pode roubar cookies/sessões.',
  'lfi': '**Local File Inclusion:** Permite que o atacante leia arquivos locais do servidor (ex: /etc/passwd) através de parâmetros mal validados.',
  'rce': '**Remote Code Execution:** A mais crítica. Permite executar comandos diretamente no sistema operacional do servidor remoto.',
  'idor': '**Insecure Direct Object Reference:** Acesso a dados de outros usuários apenas mudando IDs na URL ou parâmetros.',
  'csrf': '**Cross-Site Request Forgery:** Força um usuário autenticado a executar ações indesejadas em uma aplicação web.'
};

export const prefixCommand: PrefixCommand = {
  trigger: 'vuln',
  description: 'Explica uma vulnerabilidade específica',
  async execute(message: Message, args: string[]) {
    const name = args[0]?.toLowerCase();
    if (!name || !VULNS[name]) return message.reply(`Vulns mapeadas: ${Object.keys(VULNS).join(', ')}`);
    
    await message.reply(`⚠️ **Definição Técnica:**\n${VULNS[name]}`);
  }
};