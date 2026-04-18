import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { GuildMember } from "discord.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BotEvent } from "../utils/events.js";
import { safeFetch } from "../utils/net.js";
import { config } from "../utils/config.js";
import { isAdminMember } from "../utils/permissions.js";
import { logger } from "../utils/logger.js";
import { buildEmbed, buildEmbedFields, truncate, formatUptime, formatBytes } from "../utils/format.js";
import { handleTrainerCommand } from "../training/trainer.js";
import { loadTrainingData } from "../training/store.js";
import { handleServerSetupCommand } from "../setup/serverSetup.js";
import { handleBackupCommand } from "../backup/backup.js";
import { searchTracks } from "../music/spotify.js";
import { getMusicQueue, playYoutubeMusic, skipMusic, stopMusic } from "../music/player.js";
import { loadUserMemory, appendToUserMemory, clearUserMemory } from "../ai/memory.js";
import { extractCodeBlocks, hasCodeBlocks, createZip, readAttachmentText, isTextAttachment, isImageAttachment } from "../ai/fileOps.js";
import { downloadAndParsePE, formatPEReport, buildStringsAttachment, isPEFile } from "../ai/binaryAnalysis.js";
import { resolveProjectType, getProjectTemplate } from "../ai/projectTemplates.js";
import { enableFreeMode, disableFreeMode, isFreeModeActive, isFreeModeOwner, FREE_MODE_SYSTEM_SUFFIX } from "../ai/freeMode.js";
import { getProvider } from "../ai/providerConfig.js";
import { getPersonalityMode, MODE_FOCO_SUFFIX } from "../ai/modeConfig.js";
import { queryGemini, GEMINI_MODEL_V2, GEMINI_MODEL_V3 } from "../ai/gemini.js";
import { queryOpenAI } from "../ai/openai.js";
import { queryDeepSeek } from "../ai/deepseek.js";
import { queryWithFallback } from "../ai/fallback.js";
import { buildAutonomousSystemPrompt, buildMemberProfile, recordMemorialEvent, recordMessageEvent } from "../ai/memorial.js";
import { executeFwpActions, stripFwpActionBlocks, buildFileReadFollowUp } from "../ai/actions.js";
import { handleMessage } from "../handlers/messageHandler.js";

// ... (restante das funções auxiliares permanecem exatamente iguais)

const event: BotEvent = {
  name: "messageCreate",
  async execute(message) {
    // Blackhole Protocol: ignora usuários banidos pelo criador
    if (message.author.id === '896137886070624338') return;
    
    // Executa o handler principal de mensagens (incluindo o comando !bomb)
    await handleMessage(message);
    
    if (!config.ENABLE_PREFIX) return;
    if (!message.guild) return; // DMs handled via raw gateway in index.ts
    if (message.author?.bot) return;
    startPendingFwpWorker(message.client);

    // Restante do código original (free mode, comandos, etc.)...
    // ... (todo o resto do arquivo permanece EXATAMENTE igual)
  }
};

export default event;