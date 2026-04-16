import { SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../utils/types.js";
import { buildEmbedFields, formatUptime } from "../utils/format.js";
import { config } from "../utils/config.js";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("apresentacao")
    .setDescription("Apresenta o bot e lista todos os seus recursos"),
  async execute(interaction) {
    const prefix = config.ENABLE_PREFIX ? `\`${config.PREFIX}\`` : "desativado";
    const uptime = formatUptime(process.uptime());
    const guilds = interaction.client.guilds.cache.size;

    const fields = [
      {
        name: "\u{1F916} Sobre",
        value: "Ol\u00e1! Sou o **Fawer\u2019Bot**, assistente do servidor Fawer Blight.\nDesenvolvido em TypeScript com Discord.js v14.",
        inline: false
      },
      {
        name: "\u2699\uFE0F Sistema",
        value: [
          `Uptime: **${uptime}**`,
          `Servidores: **${guilds}**`,
          `Prefixo: ${prefix}`,
          `Node.js: **${process.version}**`
        ].join("\n"),
        inline: true
      },
      {
        name: "\u{1F4AC} Comandos",
        value: [
          "\u2022 `/ajuda` \u2014 lista completa",
          "\u2022 `/ping` \u2014 lat\u00eancia",
          "\u2022 `/info` \u2014 info do servidor",
          "\u2022 `/usuario` \u2014 perfil de usu\u00e1rio",
          "\u2022 `/admin` \u2014 ferramentas admin"
        ].join("\n"),
        inline: true
      },
      {
        name: "\u{1F3B5} M\u00fasica",
        value: [
          `\`${config.PREFIX}spf <pesquisa>\` \u2014 busca Spotify`,
          "Listagem interativa com links oficiais"
        ].join("\n"),
        inline: false
      },
      {
        name: "\u{1F9E0} IA Fawer",
        value: [
          `\`${config.PREFIX}fwp <pergunta>\` \u2014 IA treinada do servidor`,
          `\`${config.PREFIX}trainer\` \u2014 treinar a IA`
        ].join("\n"),
        inline: true
      },
      {
        name: "\u{1F4BE} Backup",
        value: [
          `\`${config.PREFIX}backup server <nome>\``,
          `\`${config.PREFIX}backup list\``,
          `\`${config.PREFIX}backup restore\``
        ].join("\n"),
        inline: true
      }
    ];

    const embed = buildEmbedFields("Fawer\u2019Bot", fields, "info",
      "Bot completo para gerenciamento de comunidades tech. Use `/ajuda` para ver todos os comandos."
    );

    if (interaction.client.user?.displayAvatarURL()) {
      embed.setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }));
    }

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
