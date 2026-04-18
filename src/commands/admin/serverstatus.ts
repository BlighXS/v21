import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { SlashCommand } from "../../utils/types.js";
import { getSystemInfo } from "../../utils/sysinfo.js";
import { logger } from "../../utils/logger.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("serverstatus")
    .setDescription("Mostra status do servidor e recursos do sistema"),
  async execute(interaction) {
    try {
      const info = getSystemInfo();
      const embed = new EmbedBuilder()
        .setTitle("🖥️ **STATUS DO SERVIDOR FAW**")
        .setDescription(`\`\`\`\n${info}\n\`\`\``)
        .setColor("#00ff00")
        .setFooter({ text: `Monitorado por Fawers Core | ${new Date().toLocaleString()}` });
      await interaction.reply({ embeds: [embed] });
      logger.info({ user: interaction.user.tag }, "Comando /serverstatus executado");
    } catch (error) {
      logger.error(error, "Falha no comando serverstatus");
      await interaction.reply({ content: "❌ Falha ao coletar status do servidor", ephemeral: true });
    }
  }
};

export default command;
