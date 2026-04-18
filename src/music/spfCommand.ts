import type {
  ButtonInteraction,
  Message,
  StringSelectMenuInteraction,
} from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { buildEmbed } from "../utils/format.js";
import { config } from "../utils/config.js";
import {
  searchTracks,
  type SpotifyTrack,
  trackFingerprint,
} from "./spotify.js";
import { logger } from "../utils/logger.js";

interface SearchSession {
  userId: string;
  guildId: string;
  voiceChannelId: string;
  createdAt: number;
  tracks: SpotifyTrack[];
}

const sessions = new Map<string, SearchSession>();

const SESSION_TTL = 5 * 60 * 1000;
const MAX_SESSIONS = 100;

function sessionKey(userId: string) {
  return `spf:${userId}`;
}

function cleanupSession(userId: string) {
  sessions.delete(sessionKey(userId));
}

function ensureChannel(message: Message): boolean {
  return (
    !config.SPOTIFY_TEXT_CHANNEL_ID ||
    message.channel.id === config.SPOTIFY_TEXT_CHANNEL_ID
  );
}

function buildIntroEmbed(query: string, tracks: SpotifyTrack[]) {
  const list = tracks
    .map((t, i) => `${i + 1}. ${t.name} – ${t.artists}`)
    .join("\n");

  return buildEmbed(
    "Spotify",
    `Pesquisa: **${query}**\nSelecione:\n${list}`,
    "action",
  );
}

function buildSelect(tracks: SpotifyTrack[], userId: string) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`spf:select:${userId}`)
    .setPlaceholder("Escolha")
    .addOptions(
      tracks.map((t) => ({
        label: t.name.slice(0, 90),
        value: trackFingerprint(t),
        description: t.artists.slice(0, 90),
      })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export async function handleSpotifyCommand(message: Message, query: string) {
  if (!ensureChannel(message)) {
    await message.reply({
      embeds: [buildEmbed("Canal incorreto", "Use o canal correto.", "warn")],
    });
    return;
  }

  if (!message.member?.voice?.channel) {
    await message.reply({
      embeds: [buildEmbed("Sem call", "Entre em uma call.", "info")],
    });
    return;
  }

  if (!query.trim()) {
    await message.reply({
      embeds: [buildEmbed("Uso", "`;spf <pesquisa>`", "info")],
    });
    return;
  }

  if (sessions.size >= MAX_SESSIONS) {
    await message.reply({
      embeds: [buildEmbed("Sistema ocupado", "Tente novamente.", "warn")],
    });
    return;
  }

  let tracks: SpotifyTrack[] = [];

  try {
    tracks = await Promise.race([
      searchTracks(query, 5),
      new Promise<SpotifyTrack[]>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout Spotify")), 10_000),
      ),
    ]);
  } catch (error) {
    logger.warn({ error }, "Erro na busca Spotify");

    await message.reply({
      embeds: [buildEmbed("Erro", "Falha na busca.", "error")],
    });
    return;
  }

  if (!tracks.length) {
    await message.reply({
      embeds: [buildEmbed("Nada", "Sem resultados.", "info")],
    });
    return;
  }

  const key = sessionKey(message.author.id);

  cleanupSession(message.author.id); // evita múltiplas sessões

  const session: SearchSession = {
    userId: message.author.id,
    guildId: message.guild?.id ?? "",
    voiceChannelId: message.member.voice.channel.id,
    createdAt: Date.now(),
    tracks: tracks.slice(0, 5), // hard limit
  };

  sessions.set(key, session);

  // auto cleanup
  setTimeout(() => {
    const current = sessions.get(key);
    if (current && Date.now() - current.createdAt >= SESSION_TTL) {
      cleanupSession(message.author.id);
      logger.info({ userId: message.author.id }, "Sessão Spotify expirada");
    }
  }, SESSION_TTL);

  const embed = buildIntroEmbed(query, session.tracks);
  const row = buildSelect(session.tracks, message.author.id);

  await message.reply({ embeds: [embed], components: [row] });
}

export async function handleSpotifySelect(
  interaction: StringSelectMenuInteraction,
) {
  if (!interaction.customId.startsWith("spf:select:")) return false;

  const userId = interaction.customId.split(":")[2];

  if (interaction.user.id !== userId) {
    await interaction.reply({ content: "Nao é seu menu.", ephemeral: true });
    return true;
  }

  const session = sessions.get(sessionKey(userId));

  if (!session) {
    await interaction.reply({
      content: "Sessao expirada.",
      ephemeral: true,
    });
    return true;
  }

  const track = session.tracks.find(
    (t) => trackFingerprint(t) === interaction.values[0],
  );

  if (!track) {
    await interaction.reply({
      content: "Musica nao encontrada.",
      ephemeral: true,
    });
    return true;
  }

  if (!track.previewUrl) {
    await interaction.reply({
      embeds: [buildEmbed("Sem preview", "Nao disponivel.", "warn")],
      ephemeral: true,
    });
    return true;
  }

  await interaction.reply({
    embeds: [
      buildEmbed(
        "Preview desabilitado",
        `${track.name} – ${track.artists}`,
        "warn",
      ),
    ],
    ephemeral: true,
  });

  return true;
}

export async function handleSpotifyButton(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith("spf:play:")) return false;

  const session = sessions.get(sessionKey(interaction.user.id));

  if (!session) {
    await interaction.reply({
      content: "Sessao expirada.",
      ephemeral: true,
    });
    return true;
  }

  const trackId = interaction.customId.split(":")[2];

  const track = session.tracks.find((t) => t.id === trackId);

  if (!track?.previewUrl) {
    await interaction.reply({
      content: "Preview indisponivel.",
      ephemeral: true,
    });
    return true;
  }

  if (!interaction.guild) {
    await interaction.reply({
      content: "Apenas servidor.",
      ephemeral: true,
    });
    return true;
  }

  const member = interaction.guild.members.cache.get(interaction.user.id);
  const voice = member?.voice?.channel;

  if (!voice) {
    await interaction.reply({
      content: "Entre em call.",
      ephemeral: true,
    });
    return true;
  }

  await interaction.reply({
    content: "Preview desabilitado.",
    ephemeral: true,
  });

  return true;
}
