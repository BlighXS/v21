import { Message } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { connectToMC, sendToMC } from "../utils/minecraft_bot.js";

const OWNER_ID = "892469618063589387";

const event: BotEvent = {
  name: "messageCreate",
  execute: async (message: Message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    if (message.author.id === OWNER_ID) {
      if (content === "!mc join") {
        await message.reply("🚀 Iniciando minha manifestação digital no servidor de Minecraft...");
        connectToMC('BlightCheiraPo.aternos.me', 23091, 'Fawers_IA', (user, msg) => {
           message.channel.send(`**[MC] ${user}:** ${msg}`);
        });
      }

      if (content.startsWith("!msg ")) {
        const text = content.replace("!msg ", "");
        sendToMC(text);
        await message.react("🌸");
      }
      
      if (content === "!bomb") {
        await message.reply("Boom! 💣");
      }
    }
  }
};

export default event;