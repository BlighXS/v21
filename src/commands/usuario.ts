import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../utils/types.js";
import { buildEmbedFields } from "../utils/format.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("usuario")
    .setDescription("Exibe informações de um usuário")
    .addUserOption((opt) =>
      opt
        .setName("alvo")
        .setDescription("Usuário para consultar (padrão: você)")
        .setRequired(false),
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

    const badges =
      target.flags?.toArray().map((f) => f.toString().replace(/_/g, " ")) ?? [];

    const badgeText = badges.length > 0 ? badges.join(", ") : "Nenhum";

    const fields = [
      { name: "🆔 ID", value: target.id, inline: true },
      { name: "🤖 Bot", value: target.bot ? "Sim" : "Não", inline: true },
      { name: "📅 Conta criada", value: createdAt, inline: true },
      { name: "📥 Entrou no servidor", value: joinedAt, inline: true },
      { name: "🧑 Apelido", value: member?.nickname ?? "Nenhum", inline: true },
      { name: "🏆 Emblemas", value: badgeText, inline: true },
      { name: "📋 Cargos", value: roles, inline: false },
    ];

    const embed = buildEmbedFields(`Usuário — ${target.tag}`, fields, "action");

    const avatar = target.displayAvatarURL({ size: 256 });
    if (avatar) embed.setThumbnail(avatar);

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
