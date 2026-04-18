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
let tokenPromise: Promise<SpotifyToken> | null = null;

const REQUEST_TIMEOUT = 10_000;
const MAX_QUERY_LENGTH = 120;

function hasSpotifyConfig(): boolean {
  return Boolean(config.SPOTIFY_CLIENT_ID && config.SPOTIFY_CLIENT_SECRET);
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function fetchWithTimeout(url: string, options: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestToken(): Promise<SpotifyToken> {
  const auth = encodeBasicAuth(
    config.SPOTIFY_CLIENT_ID,
    config.SPOTIFY_CLIENT_SECRET,
  );

  const res = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spotify token error: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 30_000,
  };
}

async function getToken(): Promise<string> {
  if (!hasSpotifyConfig()) {
    throw new Error("Spotify API nao configurada.");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  // evita múltiplos requests simultâneos
  if (!tokenPromise) {
    tokenPromise = requestToken().finally(() => {
      tokenPromise = null;
    });
  }

  cachedToken = await tokenPromise;
  return cachedToken.accessToken;
}

export async function searchTracks(
  query: string,
  limit = 5,
): Promise<SpotifyTrack[]> {
  const safeQuery = query.slice(0, MAX_QUERY_LENGTH);

  const token = await getToken();

  const url = `https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${encodeURIComponent(
    safeQuery,
  )}`;

  const res = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // força refresh de token
      cachedToken = null;
    }

    throw new Error(`Spotify search error: ${res.status}`);
  }

  const data = (await res.json()) as any;
  const items = data?.tracks?.items ?? [];

  return items.slice(0, limit).map((item: any) => {
    const images: SpotifyImage[] = item?.album?.images ?? [];

    return {
      id: item.id,
      name: item.name,
      artists: (item.artists ?? []).map((a: any) => a.name).join(", "),
      album: item.album?.name ?? "",
      previewUrl: item.preview_url ?? null,
      externalUrl: item.external_urls?.spotify ?? "",
      image: images[0]?.url,
      durationMs: item.duration_ms ?? 0,
    } as SpotifyTrack;
  });
}

export function trackFingerprint(track: SpotifyTrack): string {
  return createHash("sha1")
    .update(`${track.id}:${track.previewUrl ?? ""}`)
    .digest("hex");
}
