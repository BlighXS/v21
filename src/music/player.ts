import type { Client, Guild, VoiceBasedChannel } from "discord.js";
import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
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
}

const states = new Map<string, GuildMusicState>();

function getState(guildId: string): GuildMusicState {
  let state = states.get(guildId);
  if (!state) {
    state = {
      player: createAudioPlayer(),
      queue: [],
      playing: false
    };
    state.player.on(AudioPlayerStatus.Idle, () => {
      state!.playing = false;
      void playNext(guildId);
    });
    state.player.on("error", (error) => {
      logger.warn({ guildId, error }, "Erro no player de música");
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
    source: { youtube: "video" }
  });

  const video = search[0];
  if (!video) {
    throw new Error("Não encontrei essa música no YouTube.");
  }

  return {
    title: video.title || query,
    url: video.url,
    requestedBy: ""
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
  const stream = await play.stream(next.url, { discordPlayerCompatibility: true });
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
    metadata: next
  });
  state.player.play(resource);
  connection.subscribe(state.player);
  logger.info({ guildId, title: next.title, url: next.url }, "Tocando música");
}

export async function playYoutubeMusic(
  client: Client,
  guild: Guild,
  channel: VoiceBasedChannel,
  query: string,
  requestedBy: string,
  textChannelId?: string
): Promise<{ title: string; url: string; position: number }> {
  const state = getState(guild.id);
  state.textChannelId = textChannelId;

  const track = await findYoutubeTrack(query);
  track.requestedBy = requestedBy;

  const connection = joinVoiceChannel({
    guildId: guild.id,
    channelId: channel.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
      ]);
    } catch {
      connection.destroy();
      states.delete(guild.id);
    }
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  state.queue.push(track);
  const position = state.playing ? state.queue.length : 1;
  await playNext(guild.id);

  logger.info({ guildId: guild.id, channelId: channel.id, query, title: track.title, userId: requestedBy }, "Música enfileirada");
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
  const state = states.get(guildId);
  const connection = getVoiceConnection(guildId);
  if (!state && !connection) return false;
  state?.queue.splice(0);
  state?.player.stop(true);
  connection?.destroy();
  states.delete(guildId);
  return true;
}

export function getMusicQueue(guildId: string): QueueTrack[] {
  return [...(states.get(guildId)?.queue ?? [])];
}

export async function playPreview(
  _client: Client,
  guild: Guild,
  channel: VoiceBasedChannel,
  previewUrl: string
) {
  logger.warn({ guildId: guild.id, channelId: channel.id, previewUrl }, "Voice preview is disabled");
}
