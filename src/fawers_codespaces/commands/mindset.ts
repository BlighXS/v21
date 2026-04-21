import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'mindset',
  description: 'Explica conceitos de lógica hacker',
  async execute(message: Message) {
    const tips = [
      '**Enumeração é Tudo:** Nunca tente explorar sem conhecer cada porta e serviço do alvo.',
      '**Pense Fora da Caixa:** Se o login está bloqueado, tente resetar a senha ou interceptar o e-mail.',
      '**Persistence:** O acesso inicial é só o começo. Como você vai voltar se o servidor reiniciar?',
      '**Privilege Escalation:** No momento que entra, você é ninguém. O objetivo é sempre ser root/admin.'
    ];
    
    const tip = tips[Math.floor(Math.random() * tips.length)];
    await message.reply(`🧠 **Hacker Mindset:**\n\n${tip}`);
  }
};