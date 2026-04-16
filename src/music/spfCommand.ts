import type { ButtonInteraction, Message, StringSelectMenuInteraction } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from "discord.js";
import { buildEmbed } from "../utils/format.js";
import { config } from "../utils/config.js";
import { searchTracks, type SpotifyTrack, trackFingerprint } from "./spotify.js";
import { playPreview } from "./player.js";

interface SearchSession {
  userId: string;
  guildId: string;
  voiceChannelId: string;
  createdAt: number;
  tracks: SpotifyTrack[];
}

const sessions = new Map<string, SearchSession>();

function sessionKey(userId: string) {
  return `spf:${userId}`;
}

function ensureChannel(message: Message): boolean {
  return !config.SPOTIFY_TEXT_CHANNEL_ID || message.channel.id === config.SPOTIFY_TEXT_CHANNEL_ID;
}

function buildIntroEmbed(query: string, tracks: SpotifyTrack[]) {
  const list = tracks
    .map((t, i) => `${i + 1}. ${t.name} – ${t.artists}`)
    .join("\n");
  const lines = [
    `Pesquisa: **${query}**`,
    "Selecione a musica para tocar na call onde voce esta.",
    list
  ].join("\n");
  return buildEmbed("Spotify", lines, "action");
}

function buildSelect(tracks: SpotifyTrack[], userId: string) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`spf:select:${userId}`)
    .setPlaceholder("Escolha a musica")
    .addOptions(
      tracks.map((t) => ({
        label: t.name.slice(0, 90),
        value: trackFingerprint(t),
        description: `${t.artists}`.slice(0, 90)
      }))
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function buildPlayButton(track: SpotifyTrack) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`spf:play:${track.id}`)
      .setLabel("Tocar preview")
      .setStyle(ButtonStyle.Success)
  );
}

export async function handleSpotifyCommand(message: Message, query: string) {
  if (!ensureChannel(message)) {
    const embed = buildEmbed(
      "Canal incorreto",
      `Este comando so funciona no canal ${config.SPOTIFY_TEXT_CHANNEL_ID}.`,
      "warn"
    );
    await message.reply({ embeds: [embed] });
    return;
  }

  if (!message.member?.voice?.channel) {
    const embed = buildEmbed("Sem call", "Entre em um canal de voz primeiro.", "info");
    await message.reply({ embeds: [embed] });
    return;
  }

  if (!query.trim()) {
    const embed = buildEmbed("Uso correto", "Uso: `;spf <pesquisa>`", "info");
    await message.reply({ embeds: [embed] });
    return;
  }

  const tracks = await searchTracks(query, 5);
  if (tracks.length === 0) {
    const embed = buildEmbed("Nada encontrado", "Sem resultados para essa pesquisa.", "info");
    await message.reply({ embeds: [embed] });
    return;
  }

  const key = sessionKey(message.author.id);
  sessions.set(key, {
    userId: message.author.id,
    guildId: message.guild?.id ?? "",
    voiceChannelId: message.member.voice.channel.id,
    createdAt: Date.now(),
    tracks
  });

  const embed = buildIntroEmbed(query, tracks);
  const row = buildSelect(tracks, message.author.id);
  await message.reply({ embeds: [embed], components: [row] });
}

export async function handleSpotifySelect(interaction: StringSelectMenuInteraction) {
  if (!interaction.customId.startsWith("spf:select:")) return false;

  const userId = interaction.customId.split(":")[2];
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: "Esse menu pertence a outro usuario.", ephemeral: true });
    return true;
  }

  const key = sessionKey(userId);
  const session = sessions.get(key);
  if (!session) {
    await interaction.reply({ content: "Sessao expirada. Rode ;spf novamente.", ephemeral: true });
    return true;
  }

  const [fingerprint] = interaction.values;
  const track = session.tracks.find((t) => trackFingerprint(t) === fingerprint);
  if (!track) {
    await interaction.reply({ content: "Musica nao encontrada.", ephemeral: true });
    return true;
  }

  if (!track.previewUrl) {
    const embed = buildEmbed(
      "Sem preview",
      "Essa musica nao possui preview liberado pelo Spotify.",
      "warn"
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  const embed = buildEmbed(
    "Preview desabilitado",
    `**${track.name}** – ${track.artists}\nVoice preview desabilitado para corrigir erros de build.`,
    "warn"
  );
  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

export async function handleSpotifyButton(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith("spf:play:")) return false;

  const trackId = interaction.customId.split(":")[2];
  const key = sessionKey(interaction.user.id);
  const session = sessions.get(key);
  if (!session) {
    await interaction.reply({ content: "Sessao expirada. Rode ;spf novamente.", ephemeral: true });
    return true;
  }

  const track = session.tracks.find((t) => t.id === trackId);
  if (!track || !track.previewUrl) {
    await interaction.reply({ content: "Preview indisponivel.", ephemeral: true });
    return true;
  }

  if (!interaction.guild) {
    await interaction.reply({ content: "Apenas em servidor.", ephemeral: true });
    return true;
  }

  const member = interaction.guild.members.cache.get(interaction.user.id);
  const voice = member?.voice?.channel;
  if (!voice) {
    await interaction.reply({ content: "Entre em uma call primeiro.", ephemeral: true });
    return true;
  }

  await interaction.reply({ content: "Preview desabilitado (voice removido).", ephemeral: true });
  // await playPreview(interaction.client, interaction.guild, voice, track.previewUrl);
  return true;
}

