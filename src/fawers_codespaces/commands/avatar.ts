import type { Message } from "discord.js";
import type { PrefixCommand } from "../../ai/commandRegistry.js";

export const prefixCommand: PrefixCommand = {
  trigger: "avatar",
  description: "Mostra o avatar do usuário",
  async execute(message: Message) {
    const user = message.mentions.users.first() || message.author;

    const avatar = user.displayAvatarURL({
      size: 1024,
      extension: "png",
    });

    await message.reply({
      content: `Avatar de ${user.username}:`,
      files: [avatar],
    });
  },
};
