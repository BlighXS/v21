import type { ButtonInteraction, Message, TextBasedChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { buildEmbed } from "../utils/format.js";
import { config } from "../utils/config.js";
import { TRAIN_CHANNEL_ID, TRAINING_QUESTIONS } from "./identity.js";
import { saveTrainingData, type TrainingAnswers } from "./store.js";
import { logger } from "../utils/logger.js";

interface TrainingSession {
  userId: string;
  channelId: string;
  step: number;
  answers: TrainingAnswers;
  readyToFinalize: boolean;
  collector?: ReturnType<TextBasedChannel["createMessageCollector"]>;
  createdAt: number;
}

const sessions = new Map<string, TrainingSession>();

const SESSION_TIMEOUT = 20 * 60 * 1000;
const MAX_ANSWER_LENGTH = 1000;

function isTrainerChannel(channelId: string | null): boolean {
  return channelId === TRAIN_CHANNEL_ID;
}

function getSession(userId: string): TrainingSession | undefined {
  return sessions.get(userId);
}

function createSession(userId: string, channelId: string): TrainingSession {
  const session: TrainingSession = {
    userId,
    channelId,
    step: 0,
    answers: {},
    readyToFinalize: false,
    createdAt: Date.now(),
  };

  sessions.set(userId, session);

  // auto cleanup
  setTimeout(() => {
    const current = sessions.get(userId);
    if (current && Date.now() - current.createdAt >= SESSION_TIMEOUT) {
      endSession(userId);
      logger.warn({ userId }, "Sessão de treino expirada automaticamente");
    }
  }, SESSION_TIMEOUT);

  return session;
}

function endSession(userId: string) {
  const existing = sessions.get(userId);

  if (existing?.collector && !existing.collector.ended) {
    existing.collector.stop("ended");
  }

  sessions.delete(userId);
}

function buildIntroEmbed() {
  const text = [
    "Esse questionario serve para moldar a IA do bot.",
    "Vamos coletar informacoes sobre a comunidade, tom de voz e limites.",
    "Quando terminar, use `;trainer -f` para salvar o treino.",
  ].join("\n");

  return buildEmbed("Treinamento", text, "info");
}

function buildButtonsRow(disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("trainer:start")
      .setLabel("Treinar")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("trainer:cancel")
      .setLabel("Nao")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

async function askNextQuestion(
  channel: TextBasedChannel,
  session: TrainingSession,
) {
  const question = TRAINING_QUESTIONS[session.step];
  if (!question) return;

  const embed = buildEmbed(
    `Pergunta ${session.step + 1} de ${TRAINING_QUESTIONS.length}`,
    question.text,
    "action",
  );

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function startTrainingFlow(
  channel: TextBasedChannel,
  session: TrainingSession,
) {
  await askNextQuestion(channel, session);

  const collector = channel.createMessageCollector({
    filter: (msg) =>
      msg.author.id === session.userId && msg.channel.id === session.channelId,
    time: SESSION_TIMEOUT,
  });

  session.collector = collector;

  collector.on("collect", async (msg: Message) => {
    try {
      if (msg.content.trim().startsWith(config.PREFIX)) return;

      const question = TRAINING_QUESTIONS[session.step];
      if (!question) return;

      const answer = msg.content.trim().slice(0, MAX_ANSWER_LENGTH);

      session.answers[question.id] = answer;
      session.step += 1;

      if (session.step >= TRAINING_QUESTIONS.length) {
        session.readyToFinalize = true;
        collector.stop("finished");

        const embed = buildEmbed(
          "Treinamento concluido",
          "Perguntas finalizadas. Use `;trainer -f` para salvar o treino.",
          "ok",
        );

        await channel.send({ embeds: [embed] });
        return;
      }

      await askNextQuestion(channel, session);
    } catch (error) {
      logger.error({ error }, "Erro no collector de treinamento");
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (reason === "finished" || reason === "ended") return;

    const embed = buildEmbed(
      "Treinamento interrompido",
      "O tempo expirou. Rode `;trainer` para iniciar novamente.",
      "warn",
    );

    await channel.send({ embeds: [embed] }).catch(() => {});
    endSession(session.userId);
  });
}

export async function handleTrainerCommand(message: Message, args: string[]) {
  if (!isTrainerChannel(message.channel.id)) {
    const embed = buildEmbed(
      "Canal incorreto",
      `Este comando so funciona no canal ${TRAIN_CHANNEL_ID}.`,
      "warn",
    );

    await message.reply({ embeds: [embed] });
    return;
  }

  const existing = getSession(message.author.id);

  if (args.includes("-f")) {
    if (!existing || !existing.readyToFinalize) {
      const embed = buildEmbed(
        "Nada para finalizar",
        "Finalize apenas depois de responder todas as perguntas.",
        "info",
      );

      await message.reply({ embeds: [embed] });
      return;
    }

    try {
      const data = await saveTrainingData(existing.answers);
      endSession(message.author.id);

      const embed = buildEmbed(
        "Treino salvo",
        `Atualizado em ${new Date(data.lastUpdatedAt).toLocaleString("pt-BR")}.\nResumo:\n${data.compiledIdentity.slice(0, 1400)}`,
        "ok",
      );

      await message.reply({ embeds: [embed] });
    } catch (error) {
      logger.error({ error }, "Erro ao salvar treinamento");
    }

    return;
  }

  if (existing) {
    const embed = buildEmbed(
      "Treino em andamento",
      "Voce ja tem um treino ativo.",
      "info",
    );

    await message.reply({ embeds: [embed] });
    return;
  }

  const embed = buildIntroEmbed();
  const row = buildButtonsRow(false);

  await message.reply({ embeds: [embed], components: [row] });
}

export async function handleTrainerButton(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith("trainer:")) return false;

  if (!isTrainerChannel(interaction.channelId)) {
    const embed = buildEmbed(
      "Canal incorreto",
      `Use o canal ${TRAIN_CHANNEL_ID}.`,
      "warn",
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  const action = interaction.customId.split(":")[1];

  if (!interaction.channel || !interaction.channel.isTextBased()) {
    await interaction.reply({ content: "Canal invalido.", ephemeral: true });
    return true;
  }

  if (action === "cancel") {
    endSession(interaction.user.id);

    const embed = buildEmbed(
      "Treinamento cancelado",
      "Fluxo encerrado.",
      "info",
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (action === "start") {
    const existing = getSession(interaction.user.id);

    if (existing) {
      const embed = buildEmbed(
        "Treino em andamento",
        "Voce ja iniciou.",
        "info",
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return true;
    }

    const session = createSession(interaction.user.id, interaction.channel.id);

    const embed = buildEmbed(
      "Treinamento iniciado",
      "Responda no canal.",
      "ok",
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });

    await startTrainingFlow(interaction.channel, session);
    return true;
  }

  return false;
}
