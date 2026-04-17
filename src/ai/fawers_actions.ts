import { Client } from "discord.js";

/**
 * Módulo de ações expandido da Fawers
 */
export async function fawersSendMessage(client: Client, targetId: string, content: string) {
  try {
    const channel = await client.channels.fetch(targetId).catch(() => null);
    if (channel && "send" in channel) {
      await (channel as any).send(content);
      return { success: true };
    }
    const user = await client.users.fetch(targetId).catch(() => null);
    if (user) {
      await user.send(content);
      return { success: true };
    }
    return { success: false, error: "Alvo não encontrado" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}