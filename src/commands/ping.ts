import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../utils/types.js";
import { buildEmbed } from "../utils/format.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Testa a resposta do bot"),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const latency = Date.now() - interaction.createdTimestamp;
    const embed = buildEmbed("Status", `Pong. Latencia: ${latency}ms`, "ok");
    await interaction.editReply({ embeds: [embed] });
  }
};

export default command;
