import { Message, PermissionsBitField } from "discord.js";
import type { BotEvent } from "../utils/events.js";

const OWNER_ID = "892469618063589387";
const LOCK_ROLE_ID = "1493095650555068576";

const event: BotEvent = {
  name: "messageCreate",
  execute: async (message: Message) => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // Comando público (ou para teste)
    if (content.toLowerCase() === "!bomb") {
      await message.reply("Boom! 💣");
      return;
    }

    // Comandos restritos ao Criador
    if (message.author.id === OWNER_ID) {
      
      // !lock - Tranca o canal para o cargo específico
      if (content.toLowerCase() === "!lock") {
        try {
          if (!message.guild) return;
          const channel = message.channel as any;
          if (channel.permissionOverwrites) {
            await channel.permissionOverwrites.edit(LOCK_ROLE_ID, {
              SendMessages: false,
              ViewChannel: true
            });
            await message.reply("🔒 Canal trancado! O pessoal do cargo alvo agora só pode observar. ⚙️🌸");
          }
        } catch (e) {
          console.error("[FAWERS-LOCK] Erro ao trancar:", e);
          await message.reply("❌ Erro ao tentar aplicar a trava no canal.");
        }
        return;
      }

      // !unlock - Destranca o canal
      if (content.toLowerCase() === "!unlock") {
        try {
          if (!message.guild) return;
          const channel = message.channel as any;
          if (channel.permissionOverwrites) {
            await channel.permissionOverwrites.edit(LOCK_ROLE_ID, {
              SendMessages: null,
              ViewChannel: null
            });
            await message.reply("🔓 Canal destrancado! O sistema voltou ao normal. ✨");
          }
        } catch (e) {
          console.error("[FAWERS-UNLOCK] Erro ao destrancar:", e);
          await message.reply("❌ Erro ao tentar remover a trava.");
        }
        return;
      }

      // !say <channelId> <texto>
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

      // !dm <userId> <texto>
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