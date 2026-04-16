import { createHash } from "node:crypto";
import { config } from "../utils/config.js";

interface SpotifyToken {
  accessToken: string;
  expiresAt: number;
}

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  previewUrl: string | null;
  externalUrl: string;
  image?: string;
  durationMs: number;
}

let cachedToken: SpotifyToken | null = null;

function hasSpotifyConfig(): boolean {
  return Boolean(config.SPOTIFY_CLIENT_ID && config.SPOTIFY_CLIENT_SECRET);
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function requestToken(): Promise<SpotifyToken> {
  const auth = encodeBasicAuth(config.SPOTIFY_CLIENT_ID, config.SPOTIFY_CLIENT_SECRET);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token error: ${res.status} ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 30_000
  };
}

async function getToken(): Promise<string> {
  if (!hasSpotifyConfig()) {
    throw new Error("Spotify API nao configurada. Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.");
  }

  if (!cachedToken || cachedToken.expiresAt <= Date.now()) {
    cachedToken = await requestToken();
  }

  return cachedToken.accessToken;
}

export async function searchTracks(query: string, limit = 5): Promise<SpotifyTrack[]> {
  const token = await getToken();
  const q = encodeURIComponent(query);
  const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${q}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify search error: ${res.status} ${text}`);
  }

  const data = await res.json() as any;
  const items = data?.tracks?.items ?? [];

  return items.map((item: any) => {
    const images: SpotifyImage[] = item?.album?.images ?? [];
    return {
      id: item.id,
      name: item.name,
      artists: (item.artists ?? []).map((a: any) => a.name).join(", "),
      album: item.album?.name ?? "",
      previewUrl: item.preview_url ?? null,
      externalUrl: item.external_urls?.spotify ?? "",
      image: images[0]?.url,
      durationMs: item.duration_ms ?? 0
    } as SpotifyTrack;
  });
}

export function trackFingerprint(track: SpotifyTrack): string {
  return createHash("sha1").update(`${track.id}:${track.previewUrl ?? ""}`).digest("hex");
}
