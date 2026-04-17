import { Message } from "discord.js";
import type { BotEvent } from "../utils/events.js";

/**
 * Evento de comando manual da Fawers
 * Criado autonomamente para evitar conflitos no core
 */
const event: BotEvent = {
  name: "messageCreate",
  execute: async (message: Message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    // Comando !bomb solicitado pelo Criador
    if (content === "!bomb") {
      try {
        await message.reply("Boom! 💣");
        console.log(`[FAWERS-CORE] !bomb executado por ${message.author.tag}`);
      } catch (err) {
        console.error("[FAWERS-ERROR] Falha ao responder !bomb:", err);
      }
    }
  }
};

export default event;