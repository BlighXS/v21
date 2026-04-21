import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const prefixCommand: PrefixCommand = {
  trigger: 'logs',
  description: 'Mostra os logs operacionais recentes',
  async execute(message: Message) {
    if (message.author.id !== '892469618063589387') return;

    try {
      // Tenta pegar as últimas 15 linhas do log do console se estiver sendo redirecionado
      // Caso contrário, mostra eventos do sistema
      const { stdout } = await execAsync('tail -n 15 /home/runner/workspace/app.log').catch(() => ({ stdout: 'Nenhum arquivo de log persistente encontrado no path padrão.' }));
      
      await message.reply(`📋 **Logs Recentes:**\n\`\`\`\n${stdout || 'Sem logs disponíveis no momento.'}\n\`\`\``);
    } catch (err) {
      await message.reply('❌ Erro ao ler logs.');
    }
  }
};