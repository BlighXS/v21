import type { BotEvent } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { handleTrainerButton } from "../training/trainer.js";
import { handleServerSetupButton } from "../setup/serverSetup.js";
import { handleBackupButton, handleBackupSelect } from "../backup/backup.js";
import { isAdmin } from "../utils/permissions.js";
import { config } from "../utils/config.js";
import { sendToLogChannel } from "../utils/logChannel.js";
import { setProvider } from "../ai/providerConfig.js";
import { isFreeModeOwner } from "../ai/freeMode.js";
import { buildEmbed } from "../utils/format.js";

const event: BotEvent = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.isButton()) {
      if (interaction.customId === "fwp_model_beta" || interaction.customId === "fwp_model_v2" || interaction.customId === "fwp_model_v3") {
        if (!isFreeModeOwner(interaction.user.id)) {
          await interaction.reply({ content: "Sem permissão.", ephemeral: true });
          return;
        }
        if (interaction.customId === "fwp_model_beta") {
          await setProvider("ollama");
          const embed = buildEmbed("Setup — Fawers", "Modelo **Beta** selecionado e ativo.", "ok");
          await interaction.update({ embeds: [embed], components: [] });
        } else if (interaction.customId === "fwp_model_v2") {
          await setProvider("gemini");
          const embed = buildEmbed("Setup — Fawers", "Modelo **FAWER_V2.01** selecionado e ativo.", "ok");
          await interaction.update({ embeds: [embed], components: [] });
        } else {
          await setProvider("gemini-v3");
          const embed = buildEmbed("Setup — Fawers", "Modelo **FAWER Flash V3.0** selecionado e ativo.", "ok");
          await interaction.update({ embeds: [embed], components: [] });
        }
        logger.info({ provider: interaction.customId, user: interaction.user.id }, "Modelo FWP atualizado");
        return;
      }

      const handled = await handleTrainerButton(interaction);
      if (handled) return;
      const handledSetup = await handleServerSetupButton(interaction);
      if (handledSetup) return;
      const handledBackup = await handleBackupButton(interaction);
      if (handledBackup) return;
    }

    if (interaction.isStringSelectMenu()) {
      const handledSelect = await handleBackupSelect(interaction);
      if (handledSelect) return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    if (command.adminOnly && !isAdmin(interaction)) {
      const { buildEmbed } = await import("../utils/format.js");
      const embed = buildEmbed("Acesso negado", "Voc\u00ea n\u00e3o tem permiss\u00e3o para usar este comando.", "warn");
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    try {
      const start = Date.now();
      await command.execute(interaction);
      const durationMs = Date.now() - start;
      logger.info({
        type: "slash",
        command: interaction.commandName,
        userId: interaction.user.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        durationMs
      }, "Comando executado");
    } catch (error) {
      logger.error({ error, command: interaction.commandName }, "Erro no comando");

      const { buildEmbed } = await import("../utils/format.js");
      const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
      const embed = buildEmbed("Erro", "Ocorreu um erro ao executar o comando.", "error");

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ embeds: [embed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      } catch { /* falha ao responder */ }

      await sendToLogChannel(
        interaction.client,
        "Erro em Comando",
        `Comando: \`${interaction.commandName}\`\nUsu\u00e1rio: ${interaction.user.tag} (${interaction.user.id})\nErro: ${errMsg}`,
        "error"
      );
    }
  }
};

export default event;
