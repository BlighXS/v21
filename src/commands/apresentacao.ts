import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../utils/types.js";
import { buildEmbed } from "../utils/format.js";
import { config } from "../utils/config.js";

function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || parts.length) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("apresentacao")
    .setDescription("Apresenta o bot e seus recursos principais"),
  async execute(interaction) {
    const prefixInfo = config.ENABLE_PREFIX ? `Prefixo: \`${config.PREFIX}\`` : "Prefixo: desativado";
    const content = [
      "Ola! Eu sou o Fawer'Bot, pronto para ajudar no servidor.",
      "",
      "Recursos:",
      "- Comandos slash (/) com resposta rapida",
      "- Status e ferramentas de admin (quando permitido)",
      `- ${prefixInfo}`,
      "",
      `Uptime: ${formatUptime(process.uptime())}`
    ].join("\n");

    const embed = buildEmbed("Apresentacao", content, "info");
    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
