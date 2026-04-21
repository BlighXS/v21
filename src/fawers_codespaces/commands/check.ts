import type { Message } from "discord.js";
import type { PrefixCommand } from "../../ai/commandRegistry.js";

export const prefixCommand: PrefixCommand = {
  trigger: "check",
  description: "Mostra status do bot",
  async execute(message: Message) {
    const uptime = process.uptime();

    const horas = Math.floor(uptime / 3600);
    const minutos = Math.floor((uptime % 3600) / 60);
    const segundos = Math.floor(uptime % 60);

    const memoria = process.memoryUsage().heapUsed / 1024 / 1024;

    await message.reply(
      `Status:\n` +
        `Uptime: ${horas}h ${minutos}m ${segundos}s\n` +
        `RAM: ${memoria.toFixed(2)} MB\n` +
        `Bot: online`,
    );
  },
};
