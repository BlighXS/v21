import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const SCENARIOS = [
  '🚨 **URGÊNCIA:** Você obteve um shell reverso em um DC, mas o EDR disparou um alerta. Você tem 5 minutos antes do isolamento da máquina. Qual sua primeira ação para persistência?',
  '🚨 **URGÊNCIA:** Um dump de banco de dados está sendo exfiltrado, mas a conexão é instável e vai cair em 10 minutos. Você prioriza as tabelas de hash de senha ou os tokens de sessão ativos?',
  '🚨 **URGÊNCIA:** Você está em um Pivot dentro da rede interna. O admin acaba de logar na workstation ao lado. Se você não agir agora, perderá a janela de roubo de ticket Kerberos. O que você executa?'
];

export const prefixCommand: PrefixCommand = {
  trigger: 'pressure',
  description: 'Gera uma situação de invasão com tempo limitado',
  async execute(message: Message) {
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    await message.reply(`⏱️ **MODO PRESSÃO ATIVADO:**\n\n${scenario}`);
  }
};