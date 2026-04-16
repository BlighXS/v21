import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../../utils/types.js";
import { safeFetch } from "../../utils/net.js";
import { buildEmbed, truncate } from "../../utils/format.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("net")
    .setDescription("Ferramentas de rede")
    .addSubcommand((sub) =>
      sub
        .setName("fetch")
        .setDescription("Faz uma requisicao HTTP segura")
        .addStringOption((opt) =>
          opt.setName("url").setDescription("URL https permitida").setRequired(true)
        )
    ),
  adminOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== "fetch") return;

    const url = interaction.options.getString("url", true);
    await interaction.deferReply({ ephemeral: true });

    try {
      const content = await safeFetch(url);
      const body = content.length ? `Resposta:\n\n${truncate(content, 3500)}` : "Sem conteudo";
      const embed = buildEmbed("Net Fetch", body, "action");
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      const embed = buildEmbed("Falha", message, "error");
      await interaction.editReply({ embeds: [embed] });
    }
  }
};

export default command;
