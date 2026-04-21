import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const CHALLENGES: Record<string, string[]> = {
  'easy': [
    'Encontre um diretório oculto usando brute-force em um servidor web (dirb/gobuster).',
    'Explore uma falha de Command Injection básica em um formulário de ping.',
    'Recupere a senha de um arquivo ZIP protegido usando John the Ripper.'
  ],
  'medium': [
    'Realize Privilege Escalation explorando uma permissão SUID mal configurada.',
    'Explore um SQL Injection cego (Blind) para extrair a versão do banco de dados.',
    'Intercepte e modifique uma requisição JWT para ganhar acesso de Admin.'
  ],
  'hard': [
    'Desenvolva um exploit de Buffer Overflow simples para sobrescrever o registrador EIP.',
    'Bypasse um WAF (Web Application Firewall) usando técnicas de encoding e fragmentação.',
    'Realize um ataque de DLL Hijacking para execução de código local persistente.'
  ]
};

export const prefixCommand: PrefixCommand = {
  trigger: 'lab',
  description: 'Gera um desafio CTF para treino',
  async execute(message: Message, args: string[]) {
    const level = args[0]?.toLowerCase() || 'easy';
    if (!CHALLENGES[level]) return message.reply('Níveis disponíveis: easy, medium, hard.');

    const options = CHALLENGES[level];
    const challenge = options[Math.floor(Math.random() * options.length)];

    await message.reply(`🧪 **LABORATÓRIO FAW - NÍVEL: ${level.toUpperCase()}**\n\n**Objetivo:** ${challenge}\n\n*Dica: Use ;cheat ou ;doc se precisar de ajuda com as ferramentas.*`);
  }
};