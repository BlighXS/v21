import type { BotEvent } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { handleTrainerButton } from "../training/trainer.js";
import { handleServerSetupButton } from "../setup/serverSetup.js";
import { handleBackupButton, handleBackupSelect } from "../backup/backup.js";
// import { handleSpotifyButton, handleSpotifySelect } from "../music/spfCommand.js";
import { isAdmin } from "../utils/permissions.js";
import { config } from "../utils/config.js";

const event: BotEvent = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.isButton()) {
      const handled = await handleTrainerButton(interaction);
      if (handled) return;
      const handledSetup = await handleServerSetupButton(interaction);
      if (handledSetup) return;
      const handledBackup = await handleBackupButton(interaction);
      if (handledBackup) return;
      // Spotify disabled
      // const handledSpotify = await handleSpotifyButton(interaction);
      // if (handledSpotify) return;
    }

    if (interaction.isStringSelectMenu()) {
      const handledSelect = await handleBackupSelect(interaction);
      if (handledSelect) return;
      // Spotify disabled
      // const handledSpotifySelect = await handleSpotifySelect(interaction);
      // if (handledSpotifySelect) return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    if (command.adminOnly && !isAdmin(interaction)) {
      const { buildEmbed } = await import("../utils/format.js");
      const embed = buildEmbed("Acesso negado", "Sem permissao para este comando.", "warn");
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
      }, "Command executed");
    } catch (error) {
      logger.error({ error, command: interaction.commandName }, "Command error");
      const content = "Ocorreu um erro ao executar o comando.";

      if (interaction.deferred || interaction.replied) {
        const { buildEmbed } = await import("../utils/format.js");
        const embed = buildEmbed("Erro", content, "error");
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      } else {
        const { buildEmbed } = await import("../utils/format.js");
        const embed = buildEmbed("Erro", content, "error");
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (config.LOG_CHANNEL_ID) {
        const channel = interaction.client.channels.cache.get(config.LOG_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
          await channel.send(`Erro no comando ${interaction.commandName} por ${interaction.user.tag}`);
        }
      }
    }
  }
};

export default event;
