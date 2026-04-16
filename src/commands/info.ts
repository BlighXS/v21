import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../utils/types.js";
import { buildEmbedFields } from "../utils/format.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Exibe informa\u00e7\u00f5es detalhadas do servidor"),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "Este comando s\u00f3 funciona em servidores.", ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await guild.fetch();

    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;
    const textCount = channels.filter((c) => c.isTextBased()).size;
    const voiceCount = channels.filter((c) => c.type === 2).size;
    const catCount = channels.filter((c) => c.type === 4).size;
    const roles = guild.roles.cache.size - 1;
    const emojis = guild.emojis.cache.size;
    const members = guild.memberCount;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const humans = members - bots;
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount ?? 0;

    const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`;

    const fields = [
      { name: "\u{1F194} ID", value: guild.id, inline: true },
      { name: "\u{1F451} Dono", value: owner ? `${owner.user.tag}` : "Desconhecido", inline: true },
      { name: "\u{1F4C5} Criado em", value: createdAt, inline: true },
      {
        name: "\u{1F465} Membros",
        value: `Total: **${members}**\nHumanos: ${humans} | Bots: ${bots}`,
        inline: true
      },
      {
        name: "\u{1F4AC} Canais",
        value: `Texto: ${textCount} | Voz: ${voiceCount} | Categorias: ${catCount}`,
        inline: true
      },
      { name: "\u{1F3AD} Cargos", value: `${roles} cargos`, inline: true },
      { name: "\u{1F60E} Emojis", value: `${emojis} emojis`, inline: true },
      {
        name: "\u{1F4E3} Boost",
        value: `N\u00edvel ${boostLevel} \u2014 ${boostCount} boosts`,
        inline: true
      },
      {
        name: "\u{1F310} Regi\u00e3o",
        value: guild.preferredLocale ?? "N/A",
        inline: true
      }
    ];

    const embed = buildEmbedFields(`Informa\u00e7\u00f5es \u2014 ${guild.name}`, fields, "info");
    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 256 })!);

    await interaction.editReply({ embeds: [embed] });
  }
};

export default command;
