import dns from "node:dns/promises";
import { config } from "./config.js";

const PRIVATE_RANGES = [
  { start: "10.0.0.0", end: "10.255.255.255" },
  { start: "172.16.0.0", end: "172.31.255.255" },
  { start: "192.168.0.0", end: "192.168.255.255" },
  { start: "127.0.0.0", end: "127.255.255.255" },
  { start: "169.254.0.0", end: "169.254.255.255" },
] as const;

const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_MAX_CHARS = 5000;

function ipToInt(ip: string): number {
  const parts = ip.split(".");

  if (parts.length !== 4) {
    throw new Error("IPv4 inválido");
  }

  return (
    parts.reduce((acc, octet) => {
      const value = Number(octet);

      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error("IPv4 inválido");
      }

      return (acc << 8) + value;
    }, 0) >>> 0
  );
}

function isPrivateIp(ip: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;

  try {
    const value = ipToInt(ip);

    return PRIVATE_RANGES.some((range) => {
      const start = ipToInt(range.start);
      const end = ipToInt(range.end);
      return value >= start && value <= end;
    });
  } catch {
    return true; // falha segura
  }
}

function isAllowedDomain(hostname: string): boolean {
  if (!config.ALLOWED_DOMAINS?.length) return false;

  const normalizedHost = hostname.toLowerCase();

  return config.ALLOWED_DOMAINS.some((domain) => {
    const normalizedDomain = domain.toLowerCase();
    return (
      normalizedHost === normalizedDomain ||
      normalizedHost.endsWith(`.${normalizedDomain}`)
    );
  });
}

async function validateResolvedIps(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true });

  for (const record of records) {
    // bloqueia IPv6 local também
    if (
      isPrivateIp(record.address) ||
      record.address === "::1" ||
      record.address.startsWith("fc") ||
      record.address.startsWith("fd") ||
      record.address.startsWith("fe80")
    ) {
      throw new Error("Private/local IPs are blocked");
    }
  }
}

export async function safeFetch(
  urlRaw: string,
  options?: RequestInit,
  settings?: {
    allowAnyPublicDomain?: boolean;
    maxChars?: number;
  },
): Promise<string> {
  const url = new URL(urlRaw);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Invalid protocol");
  }

  if (!config.ALLOW_INSECURE_HTTP && url.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }

  if (!settings?.allowAnyPublicDomain && !isAllowedDomain(url.hostname)) {
    throw new Error("Domain not allowed");
  }

  if (config.BLOCK_PRIVATE_IPS) {
    await validateResolvedIps(url.hostname);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      ...options,
      signal: controller.signal,
      redirect: "manual",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const maxChars = settings?.maxChars ?? DEFAULT_MAX_CHARS;

    return text.length > maxChars
      ? `${text.slice(0, maxChars)}\n...[truncado]`
      : text;
  } finally {
    clearTimeout(timeout);
  }
}
