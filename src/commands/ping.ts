import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../utils/types.js";
import { buildEmbedFields } from "../utils/format.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Verifica a lat\u00eancia e status do bot"),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const roundtrip = Date.now() - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;

    const fields = [
      { name: "\u{1F4E1} WebSocket", value: `${ws >= 0 ? ws : "..."}ms`, inline: true },
      { name: "\u23F1\uFE0F Roundtrip", value: `${roundtrip}ms`, inline: true },
      { name: "\u{1F7E2} Status", value: "Operacional", inline: true }
    ];

    const embed = buildEmbedFields("Pong!", fields, "ok");
    await interaction.editReply({ embeds: [embed] });
  }
};

export default command;
