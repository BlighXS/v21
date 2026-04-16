import { SlashCommandBuilder } from "discord.js";
import type { GuildMember } from "discord.js";
import type { SlashCommand } from "../../utils/types.js";
import { config } from "../../utils/config.js";
import { restartProcess } from "../../utils/restart.js";
import { buildEmbed } from "../../utils/format.js";

function canRestart(member: GuildMember): boolean {
  if (config.RESTART_ROLE_IDS.length === 0) return true;
  return member.roles.cache.some((role) => config.RESTART_ROLE_IDS.includes(role.id));
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Comandos administrativos")
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Mostra status e configuracoes basicas")
    )
    .addSubcommand((sub) =>
      sub.setName("restart").setDescription("Reinicia o bot")
    ),
  adminOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "status") {
      const guild = interaction.guild;
      const content = [
        `Guild: ${guild?.name ?? "-"}`,
        `Admin roles: ${config.ADMIN_ROLE_IDS.length}`,
        `Restart roles: ${config.RESTART_ROLE_IDS.length}`,
        `Log channel: ${config.LOG_CHANNEL_ID ? "configurado" : "nao"}`,
        `Dashboard: ${config.DASHBOARD_TOKEN ? "ativo" : "inativo"}`
      ].join("\n");

      const embed = buildEmbed("Status", content, "info");
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === "restart") {
      const member = interaction.member;
      if (!member || !("roles" in member) || !canRestart(member as GuildMember)) {
        await interaction.reply({ content: "Sem permissao para este comando.", ephemeral: true });
        return;
      }

      const embed = buildEmbed("Reinicio", "Reiniciando processo...", "warn");
      await interaction.reply({ embeds: [embed], ephemeral: true });
      restartProcess();
    }
  }
};

export default command;
