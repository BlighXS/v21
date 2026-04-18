import type { BotEvent } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { handleTrainerButton } from "../training/trainer.js";
import { handleServerSetupButton } from "../setup/serverSetup.js";
import { handleBackupButton, handleBackupSelect } from "../backup/backup.js";
import { isAdmin } from "../utils/permissions.js";
import { config } from "../utils/config.js";
import { sendToLogChannel } from "../utils/logChannel.js";
import { setProvider, type AIProvider } from "../ai/providerConfig.js";
import { isFreeModeOwner } from "../ai/freeMode.js";
import { setPersonalityMode, type PersonalityMode } from "../ai/modeConfig.js";
import { buildEmbed } from "../utils/format.js";
import { getPendingWrite, deletePendingWrite, isExpired } from "../ai/pendingWrites.js";
import { writeSourceFile } from "../utils/sysinfo.js";
import { recordMemorialEvent } from "../ai/memorial.js";

const event: BotEvent = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("fwp_write_confirm_") || interaction.customId.startsWith("fwp_write_cancel_")) {
        const isConfirm = interaction.customId.startsWith("fwp_write_confirm_");
        const pwId = interaction.customId.replace("fwp_write_confirm_", "").replace("fwp_write_cancel_", "");
        const pw = getPendingWrite(pwId);

        if (!pw) {
          await interaction.reply({ content: "Esta confirmação já expirou ou foi processada.", ephemeral: true });
          return;
        }

        if (interaction.user.id !== pw.requestedBy) {
          await interaction.reply({ content: "Só quem solicitou essa alteração pode confirmar.", ephemeral: true });
          return;
        }

        if (isExpired(pw)) {
          deletePendingWrite(pwId);
          await interaction.update({ content: `⏰ Confirmação de \`${pw.path}\` expirou. Peça pra Fawers gerar de novo.`, components: [] });
          return;
        }

        deletePendingWrite(pwId);

        if (!isConfirm) {
          await interaction.update({ content: `❌ Escrita de \`${pw.path}\` **cancelada**.`, components: [] });
          await recordMemorialEvent({ type: "system", content: `Escrita cancelada pelo dono: ${pw.path}` });
          logger.info({ path: pw.path, userId: interaction.user.id }, "Escrita cancelada pelo usuário");
          return;
        }

        try {
          await writeSourceFile(pw.path, pw.newContent);
          await recordMemorialEvent({
            type: "system",
            content: `Arquivo escrito e confirmado pelo dono: ${pw.path} (+${pw.addedLines}/-${pw.removedLines} linhas)`,
            userId: interaction.user.id,
            username: interaction.user.tag
          });
          logger.info({ path: pw.path, addedLines: pw.addedLines, removedLines: pw.removedLines }, "Escrita confirmada e aplicada");

          const confirmText = [
            `✅ \`${pw.path}\` escrito com sucesso.`,
            `**+${pw.addedLines}** adicionadas | **-${pw.removedLines}** removidas`,
            "",
            "⚠️ **Reinicie o bot** para as mudanças entrarem em efeito."
          ].join("\n");

          await interaction.update({ content: confirmText, components: [] });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await interaction.update({ content: `❌ Erro ao escrever \`${pw.path}\`: ${msg}`, components: [] });
          logger.error({ err, path: pw.path }, "Erro ao aplicar escrita confirmada");
        }
        return;
      }

      if (interaction.customId === "fwp_model_beta" || interaction.customId === "fwp_model_v2" || interaction.customId === "fwp_model_v3" || interaction.customId === "fwp_model_v4" || interaction.customId === "fwp_model_v5") {
        if (!isFreeModeOwner(interaction.user.id)) {
          await interaction.reply({ content: "Sem permissão.", ephemeral: true });
          return;
        }
        let providerKey: string;
        let label: string;
        if (interaction.customId === "fwp_model_beta") {
          providerKey = "ollama"; label = "Motor **Beta** selecionado e ativo.";
        } else if (interaction.customId === "fwp_model_v2") {
          providerKey = "gemini"; label = "**FAWER V2** selecionada e ativa.";
        } else if (interaction.customId === "fwp_model_v3") {
          providerKey = "gemini-v3"; label = "**FAWER V3** selecionada e ativa.";
        } else if (interaction.customId === "fwp_model_v4") {
          providerKey = "openai-v4"; label = "**FAWER V4** selecionada e ativa.";
        } else {
          providerKey = "deepseek-v5"; label = "**FAWER V5** selecionada e ativa.";
        }
        await setProvider(providerKey as AIProvider);
        const embed = buildEmbed("✅ Setup — Fawers", label, "ok");
        try {
          await interaction.update({ embeds: [embed], components: [] });
        } catch {
          // Interação expirada — tenta responder como fallback
          try { await interaction.reply({ embeds: [embed], ephemeral: true }); } catch { /* ignorar */ }
        }
        logger.info({ provider: providerKey, user: interaction.user.id }, "AI provider atualizado");
        return;
      }

      if (interaction.customId === "fwp_mode_gentil" || interaction.customId === "fwp_mode_foco") {
        if (!isFreeModeOwner(interaction.user.id)) {
          await interaction.reply({ content: "Sem permissão.", ephemeral: true });
          return;
        }
        const mode: PersonalityMode = interaction.customId === "fwp_mode_gentil" ? "gentil" : "foco";
        await setPersonalityMode(mode);
        const label = mode === "gentil"
          ? "Modo **Gentil 🌸** ativado. A Fawers vai responder com o estilo caloroso de sempre."
          : "Modo **Foco ⚡** ativado. A Fawers vai ser direta, técnica e sem rodeios.";
        const embed = buildEmbed("Fawers — Modo atualizado", label, "ok");
        try {
          await interaction.update({ embeds: [embed], components: [] });
        } catch {
          try { await interaction.reply({ embeds: [embed], ephemeral: true }); } catch { /* ignorar */ }
        }
        logger.info({ mode, user: interaction.user.id }, "Modo de personalidade atualizado");
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
