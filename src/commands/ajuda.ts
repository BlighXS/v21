import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../utils/types.js";
import { buildEmbedFields } from "../utils/format.js";
import { config } from "../utils/config.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ajuda")
    .setDescription("Lista todos os comandos e recursos do bot"),
  async execute(interaction) {
    const prefix = config.PREFIX;

    const fields = [
      {
        name: "\u2022 Gerais",
        value: [
          "`/ping` \u2014 Verifica a lat\u00eancia do bot",
          "`/apresentacao` \u2014 Apresenta o bot e seus recursos",
          "`/ajuda` \u2014 Exibe esta mensagem",
          "`/info` \u2014 Informa\u00e7\u00f5es do servidor",
          "`/usuario [@usu\u00e1rio]` \u2014 Informa\u00e7\u00f5es de um usu\u00e1rio"
        ].join("\n"),
        inline: false
      },
      {
        name: "\u2022 Administra\u00e7\u00e3o",
        value: [
          "`/admin status` \u2014 Status e m\u00e9tricas do bot",
          "`/admin restart` \u2014 Reinicia o bot",
          "`/net fetch <url>` \u2014 Requisi\u00e7\u00e3o HTTP segura"
        ].join("\n"),
        inline: false
      },
      {
        name: "\u2022 M\u00fasica (Spotify)",
        value: [
          `\`${prefix}spf <pesquisa>\` \u2014 Busca m\u00fasicas no Spotify`,
          "Selecione a m\u00fasica no menu para ver detalhes e link oficial."
        ].join("\n"),
        inline: false
      },
      {
        name: "\u2022 IA Fawer",
        value: [
          `\`${prefix}fwp <pergunta>\` \u2014 Consulta a IA treinada do servidor`,
          `\`${prefix}trainer\` \u2014 Inicia o treinamento da IA (admins)`
        ].join("\n"),
        inline: false
      },
      {
        name: "\u2022 Backup",
        value: [
          `\`${prefix}backup server <nome>\` \u2014 Cria backup do servidor`,
          `\`${prefix}backup list\` \u2014 Lista backups salvos`,
          `\`${prefix}backup restore\` \u2014 Restaura um backup`
        ].join("\n"),
        inline: false
      },
      {
        name: "\u2022 Outros (prefixo)",
        value: [
          `\`${prefix}ping\` \u2014 Verifica lat\u00eancia`,
          `\`${prefix}ajuda\` \u2014 Ajuda dos comandos`,
          `\`${prefix}info\` \u2014 Info do servidor`,
          `\`${prefix}svrc\` \u2014 Setup estrutural do servidor (admins)`,
          `\`${prefix}restart\` \u2014 Reinicia o bot (admins)`
        ].join("\n"),
        inline: false
      }
    ];

    const embed = buildEmbedFields(
      "Fawer\u2019Bot \u2014 Ajuda",
      fields,
      "info",
      `Prefixo de mensagens: \`${prefix}\`\nUse os comandos barra \`/\` ou o prefixo \`${prefix}\` para interagir.`
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

export default command;
