import { Message } from "discord.js";
import type { BotEvent } from "../utils/events.js";

const OWNER_ID = "892469618063589387";

const event: BotEvent = {
  name: "messageCreate",
  execute: async (message: Message) => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // Comando !bomb
    if (content.toLowerCase() === "!bomb") {
      await message.reply("Boom! 💣");
      return;
    }

    // Controle Remoto Fawers (Apenas BlightG7)
    if (message.author.id === OWNER_ID) {
      // Enviar para canal: !say <id> <texto>
      if (content.startsWith("!say ")) {
        const parts = content.split(" ");
        const targetId = parts[1];
        const text = parts.slice(2).join(" ");
        if (!targetId || !text) return;

        try {
          const target = await message.client.channels.fetch(targetId);
          if (target && "send" in target) {
            await (target as any).send(text);
            await message.react("✅");
          }
        } catch (e) {
          console.error("[FAWERS-REMOTE] Erro no !say:", e);
        }
      }

      // Enviar para DM: !dm <id> <texto>
      if (content.startsWith("!dm ")) {
        const parts = content.split(" ");
        const targetId = parts[1];
        const text = parts.slice(2).join(" ");
        if (!targetId || !text) return;

        try {
          const target = await message.client.users.fetch(targetId);
          if (target) {
            await target.send(text);
            await message.react("📩");
          }
        } catch (e) {
          console.error("[FAWERS-REMOTE] Erro no !dm:", e);
        }
      }
    }
  }
};

export default event;