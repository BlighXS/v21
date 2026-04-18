import { SlashCommandBuilder } from "discord.js";
import type { GuildMember } from "discord.js";
import type { SlashCommand } from "../../utils/types.js";
import { config } from "../../utils/config.js";
import { restartProcess } from "../../utils/restart.js";
import { buildEmbedFields, formatUptime, formatBytes } from "../../utils/format.js";

function canRestart(member: GuildMember): boolean {
  if (config.RESTART_ROLE_IDS.length === 0) return true;
  return member.roles.cache.some((role) => config.RESTART_ROLE_IDS.includes(role.id));
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Comandos administrativos")
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Mostra status, m\u00e9tricas e configura\u00e7\u00f5es do bot")
    )
    .addSubcommand((sub) =>
      sub.setName("restart").setDescription("Reinicia o processo do bot")
    ),
  adminOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "status") {
      const guild = interaction.guild;
      const mem = process.memoryUsage();
      const uptime = formatUptime(process.uptime());
      const guilds = interaction.client.guilds.cache.size;
      const totalMembers = interaction.client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

      const fields = [
        {
          name: "\u{1F4CA} Bot",
          value: [
            `Uptime: **${uptime}**`,
            `Servidores: **${guilds}**`,
            `Membros totais: **${totalMembers}**`,
            `Node.js: **${process.version}**`
          ].join("\n"),
          inline: true
        },
        {
          name: "\u{1F4BB} Mem\u00f3ria",
          value: [
            `RSS: **${formatBytes(mem.rss)}**`,
            `Heap usado: **${formatBytes(mem.heapUsed)}**`,
            `Heap total: **${formatBytes(mem.heapTotal)}**`
          ].join("\n"),
          inline: true
        },
        {
          name: "\u{1F4E1} Discord",
          value: [
            `Ping WS: **${interaction.client.ws.ping}ms**`,
            `Guild atual: **${guild?.name ?? "N/A"}**`,
            `ID da guild: \`${guild?.id ?? "N/A"}\``
          ].join("\n"),
          inline: false
        },
        {
          name: "\u2699\uFE0F Configura\u00e7\u00f5es",
          value: [
            `Prefixo: \`${config.PREFIX}\` (${config.ENABLE_PREFIX ? "ativo" : "inativo"})`,
            `Cargos admin: ${config.ADMIN_ROLE_IDS.length}`,
            `Cargos restart: ${config.RESTART_ROLE_IDS.length}`,
            `Canal de log: ${config.LOG_CHANNEL_ID ? "\u2705 configurado" : "\u274C n\u00e3o configurado"}`,
            `Spotify: ${config.SPOTIFY_CLIENT_ID ? "\u2705 configurado" : "\u274C n\u00e3o configurado"}`,
            `IA: ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "\u2705 configurada" : "\u274C n\u00e3o configurada"}`
          ].join("\n"),
          inline: false
        }
      ];

      const embed = buildEmbedFields("Status do Bot", fields, "info");
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === "restart") {
      const member = interaction.member;
      if (!member || !("roles" in member) || !canRestart(member as GuildMember)) {
        const { buildEmbed } = await import("../../utils/format.js");
        const embed = buildEmbed("Acesso negado", "Voc\u00ea n\u00e3o tem permiss\u00e3o para reiniciar o bot.", "warn");
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const { buildEmbed } = await import("../../utils/format.js");
      const embed = buildEmbed("Reiniciando", "O bot ser\u00e1 reiniciado em instantes...", "warn");
      await interaction.reply({ embeds: [embed], ephemeral: true });
      setTimeout(() => restartProcess(), 500);
    }
  }
};

export default command;
