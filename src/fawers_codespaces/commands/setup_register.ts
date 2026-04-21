import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
} from "discord.js";

export const prefixCommand = {
  trigger: "setup-register",
  description: "Inicializa o portal de registro.",

  async execute(message: Message) {
    if (message.author.id !== "892469618063589387") return;

    try {
      const embed = new EmbedBuilder()
        .setTitle("🔰 FAW ACCESS SYSTEM")
        .setColor("#800080")
        .setDescription(
          "Sistema de autenticação operacional.\n\n" +
            "Clique abaixo para iniciar seu registro.",
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("faw_start_reg")
          .setLabel("Iniciar Registro")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🛡️"),
      );

      const sent = await message.channel.send({
        embeds: [embed],
        components: [row],
      });

      if (sent) {
        await message.delete().catch(() => {});
      }
    } catch (err) {
      console.error("erro setup-register:", err);
    }
  },
};
