import type { BotEvent } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { handleTrainerButton } from "../training/trainer.js";
import { handleServerSetupButton } from "../setup/serverSetup.js";
import { handleBackupButton, handleBackupSelect } from "../backup/backup.js";
import { isAdmin } from "../utils/permissions.js";
import { sendToLogChannel } from "../utils/logChannel.js";
import { setProvider, type AIProvider } from "../ai/providerConfig.js";
import { isFreeModeOwner } from "../ai/freeMode.js";
import { setPersonalityMode, type PersonalityMode } from "../ai/modeConfig.js";
import { buildEmbed } from "../utils/format.js";
import {
  getPendingWrite,
  deletePendingWrite,
  isExpired,
} from "../ai/pendingWrites.js";
import { writeSourceFile } from "../utils/sysinfo.js";
import { recordMemorialEvent } from "../ai/memorial.js";

const SAFE_REPLY = async (interaction: any, payload: any) => {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch {
    // evita crash por interação expirada
  }
};

async function handleWriteFlow(interaction: any) {
  const id = interaction.customId;
  if (!id.startsWith("fwp_write_")) return false;

  const isConfirm = id.includes("confirm");
  const pwId = id.split("_").pop();
  const pw = pwId ? getPendingWrite(pwId) : null;

  if (!pw) {
    await SAFE_REPLY(interaction, { content: "Expirado.", ephemeral: true });
    return true;
  }

  if (interaction.user.id !== pw.requestedBy) {
    await SAFE_REPLY(interaction, {
      content: "Sem permissão.",
      ephemeral: true,
    });
    return true;
  }

  if (isExpired(pw)) {
    deletePendingWrite(pwId!);
    await SAFE_REPLY(interaction, {
      content: "Tempo expirado.",
      ephemeral: true,
    });
    return true;
  }

  deletePendingWrite(pwId!);

  if (!isConfirm) {
    await SAFE_REPLY(interaction, { content: "Cancelado.", ephemeral: true });
    logger.info({ path: pw.path }, "Write cancelado");
    return true;
  }

  try {
    await writeSourceFile(pw.path, pw.newContent);

    logger.info(
      {
        path: pw.path,
        added: pw.addedLines,
        removed: pw.removedLines,
      },
      "Write aplicado",
    );

    await SAFE_REPLY(interaction, {
      content: `✅ ${pw.path} atualizado. Reiniciando...`,
      ephemeral: true,
    });

    setTimeout(async () => {
      const { restartProcess } = await import("../utils/restart.js");
      restartProcess();
    }, 1500);
  } catch (err) {
    logger.error({ err }, "Erro write");
    await SAFE_REPLY(interaction, {
      content: "Erro ao escrever.",
      ephemeral: true,
    });
  }

  return true;
}

async function handleModelSwitch(interaction: any) {
  if (!interaction.customId.startsWith("fwp_model_")) return false;

  if (!isFreeModeOwner(interaction.user.id)) {
    await SAFE_REPLY(interaction, {
      content: "Sem permissão.",
      ephemeral: true,
    });
    return true;
  }

  const map: Record<string, { key: AIProvider; label: string }> = {
    beta: { key: "ollama", label: "Beta ativo" },
    v2: { key: "gemini", label: "V2 ativa" },
    v3: { key: "gemini-v3", label: "V3 ativa" },
    v4: { key: "openai-v4", label: "V4 ativa" },
    v5: { key: "deepseek-v5", label: "V5 ativa" },
  };

  const key = interaction.customId.split("_").pop();
  const entry = key ? map[key] : null;
  if (!entry) return false;

  await setProvider(entry.key);

  await SAFE_REPLY(interaction, {
    embeds: [buildEmbed("IA atualizada", entry.label, "ok")],
    ephemeral: true,
  });

  logger.info({ provider: entry.key }, "Provider trocado");
  return true;
}

async function handleModeSwitch(interaction: any) {
  if (!interaction.customId.startsWith("fwp_mode_")) return false;

  if (!isFreeModeOwner(interaction.user.id)) {
    await SAFE_REPLY(interaction, {
      content: "Sem permissão.",
      ephemeral: true,
    });
    return true;
  }

  const mode: PersonalityMode = interaction.customId.endsWith("gentil")
    ? "gentil"
    : "foco";

  await setPersonalityMode(mode);

  await SAFE_REPLY(interaction, {
    embeds: [buildEmbed("Modo atualizado", mode, "ok")],
    ephemeral: true,
  });

  logger.info({ mode }, "Modo trocado");
  return true;
}

const event: BotEvent = {
  name: "interactionCreate",

  async execute(interaction) {
    try {
      // ================= BUTTONS =================
      if (interaction.isButton()) {
        if (await handleWriteFlow(interaction)) return;
        if (await handleModelSwitch(interaction)) return;
        if (await handleModeSwitch(interaction)) return;

        if (await handleTrainerButton(interaction)) return;
        if (await handleServerSetupButton(interaction)) return;
        if (await handleBackupButton(interaction)) return;
      }

      // ================= SELECT =================
      if (interaction.isStringSelectMenu()) {
        if (await handleBackupSelect(interaction)) return;
      }

      // ================= SLASH =================
      if (!interaction.isChatInputCommand()) return;

      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      if (command.adminOnly && !isAdmin(interaction)) {
        await SAFE_REPLY(interaction, {
          embeds: [buildEmbed("Acesso negado", "Sem permissão.", "warn")],
          ephemeral: true,
        });
        return;
      }

      const start = Date.now();

      await command.execute(interaction);

      logger.info(
        {
          command: interaction.commandName,
          duration: Date.now() - start,
        },
        "Slash executado",
      );
    } catch (error) {
      logger.error({ error }, "Erro interactionCreate");

      await SAFE_REPLY(interaction, {
        embeds: [buildEmbed("Erro", "Falha ao executar.", "error")],
        ephemeral: true,
      });

      await sendToLogChannel(
        interaction.client,
        "Erro",
        `Erro em interação: ${interaction.user?.tag}`,
        "error",
      );
    }
  },
};

export default event;
