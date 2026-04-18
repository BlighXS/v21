import { CommandInteraction, EmbedBuilder } from "discord.js";
import { sysinfo } from "../../utils/sysinfo.js";
import { logger } from "../../utils/logger.js";

export const data = {
  name: "serverstatus",
  description: "Mostra status do servidor e recursos do sistema"
};

export async function execute(interaction: CommandInteraction) {
  try {
    const { cpu, memory, uptime } = await sysinfo();
    const embed = new EmbedBuilder()
      .setTitle("🖥️ **STATUS DO SERVIDOR FAW**")
      .addFields(
        { name: "CPU", value: `\`${cpu.cores}x ${cpu.model}\`\n**Uso:** ${cpu.usage}%`, inline: true },
        { name: "RAM", value: `**Total:** ${memory.total} MB\n**Livre:** ${memory.free} MB`, inline: true },
        { name: "Uptime", value: `\`${uptime}\``, inline: false }
      )
      .setColor("#00ff00")
      .setFooter({ text: `Monitorado por Fawers Core | ${new Date().toLocaleString()}` });
    await interaction.reply({ embeds: [embed] });
    logger.info({ user: interaction.user.tag }, "Comando !serverstatus executado");
  } catch (error) {
    logger.error(error, "Falha no comando serverstatus");
    await interaction.reply({ content: "❌ Falha ao coletar status do servidor", ephemeral: true });
  }
}