import type { Client, Guild, VoiceBasedChannel } from "discord.js";
import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
import play from "play-dl";
import { logger } from "../utils/logger.js";

interface QueueTrack {
  title: string;
  url: string;
  requestedBy: string;
}

interface GuildMusicState {
  player: ReturnType<typeof createAudioPlayer>;
  queue: QueueTrack[];
  playing: boolean;
  textChannelId?: string;
  createdAt: number;
}

const states = new Map<string, GuildMusicState>();

const MAX_QUEUE_SIZE = 50;
const STREAM_TIMEOUT = 15_000;
const IDLE_TIMEOUT = 5 * 60 * 1000;

function cleanupState(guildId: string) {
  const state = states.get(guildId);
  if (!state) return;

  try {
    state.player.stop(true);
  } catch {}

  states.delete(guildId);
}

function getState(guildId: string): GuildMusicState {
  let state = states.get(guildId);

  if (!state) {
    const player = createAudioPlayer();

    state = {
      player,
      queue: [],
      playing: false,
      createdAt: Date.now(),
    };

    player.on(AudioPlayerStatus.Idle, () => {
      state!.playing = false;

      if (state!.queue.length === 0) {
        setTimeout(() => {
          const current = states.get(guildId);
          if (current && current.queue.length === 0 && !current.playing) {
            logger.info({ guildId }, "Encerrando player por inatividade");
            const conn = getVoiceConnection(guildId);
            conn?.destroy();
            cleanupState(guildId);
          }
        }, IDLE_TIMEOUT);
      }

      void playNext(guildId);
    });

    player.on("error", (error) => {
      logger.warn({ guildId, error }, "Erro no player");
      state!.playing = false;
      void playNext(guildId);
    });

    states.set(guildId, state);
  }

  return state;
}

async function findYoutubeTrack(query: string): Promise<QueueTrack> {
  const search = await play.search(query, {
    limit: 1,
    source: { youtube: "video" },
  });

  const video = search[0];
  if (!video) {
    throw new Error("Não encontrei essa música.");
  }

  return {
    title: video.title || query,
    url: video.url,
    requestedBy: "",
  };
}

async function playNext(guildId: string): Promise<void> {
  const state = states.get(guildId);
  if (!state || state.playing) return;

  const next = state.queue.shift();
  if (!next) return;

  const connection = getVoiceConnection(guildId);
  if (!connection) {
    state.queue.unshift(next);
    return;
  }

  state.playing = true;

  try {
    const stream = await Promise.race([
      play.stream(next.url, { discordPlayerCompatibility: true }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout no stream")),
          STREAM_TIMEOUT,
        ),
      ),
    ]);

    const resource = createAudioResource((stream as any).stream, {
      inputType: (stream as any).type,
      metadata: next,
    });

    state.player.play(resource);
    connection.subscribe(state.player);

    logger.info({ guildId, title: next.title }, "Tocando");
  } catch (error) {
    logger.warn({ guildId, error }, "Erro ao tocar música");
    state.playing = false;
    void playNext(guildId);
  }
}

export async function playYoutubeMusic(
  client: Client,
  guild: Guild,
  channel: VoiceBasedChannel,
  query: string,
  requestedBy: string,
  textChannelId?: string,
): Promise<{ title: string; url: string; position: number }> {
  const state = getState(guild.id);
  state.textChannelId = textChannelId;

  if (state.queue.length >= MAX_QUEUE_SIZE) {
    throw new Error("Fila cheia.");
  }

  const track = await findYoutubeTrack(query);
  track.requestedBy = requestedBy;

  let connection = getVoiceConnection(guild.id);

  if (!connection) {
    connection = joinVoiceChannel({
      guildId: guild.id,
      channelId: channel.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection!, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection!, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        logger.warn({ guildId: guild.id }, "Conexão perdida, limpando estado");
        connection!.destroy();
        cleanupState(guild.id);
      }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  }

  state.queue.push(track);
  const position = state.playing ? state.queue.length : 1;

  await playNext(guild.id);

  logger.info(
    {
      guildId: guild.id,
      title: track.title,
      userId: requestedBy,
    },
    "Enfileirada",
  );

  void client;
  return { title: track.title, url: track.url, position };
}

export function skipMusic(guildId: string): boolean {
  const state = states.get(guildId);
  if (!state) return false;

  state.player.stop(true);
  return true;
}

export function stopMusic(guildId: string): boolean {
  const connection = getVoiceConnection(guildId);

  cleanupState(guildId);
  connection?.destroy();

  return true;
}

export function getMusicQueue(guildId: string): QueueTrack[] {
  return [...(states.get(guildId)?.queue ?? [])];
}

export async function playPreview(
  _client: Client,
  guild: Guild,
  channel: VoiceBasedChannel,
  previewUrl: string,
) {
  logger.warn(
    { guildId: guild.id, channelId: channel.id, previewUrl },
    "Preview desativado",
  );
}
