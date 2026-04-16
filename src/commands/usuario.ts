import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../utils/types.js";
import { buildEmbedFields } from "../utils/format.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("usuario")
    .setDescription("Exibe informa\u00e7\u00f5es de um usu\u00e1rio")
    .addUserOption((opt) =>
      opt
        .setName("alvo")
        .setDescription("Usu\u00e1rio para consultar (padr\u00e3o: voc\u00ea)")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("alvo") ?? interaction.user;
    const guild = interaction.guild;

    let member = null;
    if (guild) {
      member = await guild.members.fetch(target.id).catch(() => null);
    }

    const createdAt = `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`;
    const joinedAt = member?.joinedTimestamp
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`
      : "Desconhecido";

    const roles = member
      ? member.roles.cache
          .filter((r) => r.name !== "@everyone")
          .sort((a, b) => b.position - a.position)
          .map((r) => `<@&${r.id}>`)
          .slice(0, 10)
          .join(", ") || "Nenhum"
      : "N/A";

    const badges = target.flags?.toArray()?.map((f) => f.toString().replace(/_/g, " ")) ?? [];
    const badgeText = badges.length ? badges.join(", ") : "Nenhum";

    const fields = [
      { name: "\u{1F194} ID", value: target.id, inline: true },
      { name: "\u{1F916} Bot", value: target.bot ? "Sim" : "N\u00e3o", inline: true },
      { name: "\u{1F4C5} Conta criada", value: createdAt, inline: true },
      { name: "\u{1F4C5} Entrou no servidor", value: joinedAt, inline: true },
      { name: "\u{1F3AD} Apelido", value: member?.nickname ?? "Nenhum", inline: true },
      { name: "\u{1F3C6} Emblemas", value: badgeText, inline: true },
      { name: "\u{1F4CB} Cargos", value: roles, inline: false }
    ];

    const embed = buildEmbedFields(`Usu\u00e1rio \u2014 ${target.tag}`, fields, "action");
    const avatar = target.displayAvatarURL({ size: 256 });
    if (avatar) embed.setThumbnail(avatar);

    await interaction.editReply({ embeds: [embed] });
  }
};

export default command;
