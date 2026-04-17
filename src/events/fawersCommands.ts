import { Message } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { setupMC, startMC, sendMCCommand } from "../utils/minecraft.js";

const OWNER_ID = "892469618063589387";

const event: BotEvent = {
  name: "messageCreate",
  execute: async (message: Message) => {
    if (message.author.bot) return;
    const content = message.content.trim();

    if (message.author.id === OWNER_ID) {
      if (content === "!mc setup") {
        await message.reply("⚙️ Iniciando setup do Minecraft 1.21.1... Baixando JAR e aceitando EULA.");
        await setupMC();
        await message.reply("✅ Setup concluído! Use `!mc start` para ligar o motor.");
      }

      if (content === "!mc start") {
        const status = startMC((data) => {
          if (data.includes("Done")) message.channel.send("🚀 **Servidor Online!** Pode entrar, Criador! IP: `localhost` (ou o IP do host).");
          if (data.includes("joined the game")) message.channel.send("🌸 Fawers detectou sua entrada! Bem-vindo ao nosso mundo!");
        });
        await message.reply(status);
      }

      if (content.startsWith("!mc cmd ")) {
        const cmd = content.replace("!mc cmd ", "");
        sendMCCommand(cmd);
        await message.react("⚙️");
      }
    }
  }
};

export default event;