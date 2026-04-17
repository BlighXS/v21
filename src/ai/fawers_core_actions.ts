import { Client, Message, ChannelType } from 'discord.js';
import { logger } from '../utils/logger.js';
import { recordMessageEvent } from './memorial.js';

/**
 * Novo Motor de Ações Fawers Core
 * Sem travas de servidor para DMs e comandos remotos
 */
export async function executeFwpActions(message: Message, rawResponse: string) {
  const actions = extractActions(rawResponse);
  const reports: string[] = [];
  const fileReads: any[] = [];

  for (const action of actions) {
    try {
      if (action.type === 'send_message') {
        const result = await executeSendMessage(message.client, action.channelId || action.channel, action.content);
        reports.push(result);
      } else if (action.type === 'read_source_file') {
        // Encaminha para o utilitário de sistema
        const { readSourceFile } = await import('../utils/sysinfo.js');
        const content = await readSourceFile(action.path);
        fileReads.push({ path: action.path, content });
        reports.push(`Arquivo lido: \`${action.path}\``);
      } else if (action.type === 'restart_self') {
        reports.push("Reiniciando sistema...");
        setTimeout(() => process.exit(0), 1000);
      }
      // Outras ações serão migradas para cá conforme necessário
    } catch (err) {
      reports.push(`Erro na ação ${action.type}: ${err}`);
    }
  }

  return { reports, fileReads };
}

async function executeSendMessage(client: Client, targetId: string | undefined, content: string | undefined): Promise<string> {
  if (!targetId || !content) return "Dados insuficientes para enviar mensagem.";

  try {
    // Tenta como canal
    const channel = await client.channels.fetch(targetId).catch(() => null);
    if (channel && 'send' in channel) {
      await (channel as any).send(content);
      return `Mensagem enviada para o canal <#${targetId}>.`;
    }

    // Tenta como usuário (DM)
    const user = await client.users.fetch(targetId).catch(() => null);
    if (user) {
      await user.send(content);
      return `Mensagem enviada para a DM de **${user.tag}**.`;
    }

    return `Não encontrei o alvo \`${targetId}\` no servidor ou em DMs.`;
  } catch (err) {
    return `Falha ao enviar: ${err}`;
  }
}

function extractActions(text: string): any[] {
  const actions: any[] = [];
  const regex = /\[FWP_ACTION\]([\s\S]*?)\[\/FWP_ACTION\]/g;
  for (const match of text.matchAll(regex)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      actions.push(parsed);
    } catch {}
  }
  return actions;
}
