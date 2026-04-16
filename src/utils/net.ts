import dns from "node:dns/promises";
import { config } from "./config.js";

const PRIVATE_RANGES = [
  { start: "10.0.0.0", end: "10.255.255.255" },
  { start: "172.16.0.0", end: "172.31.255.255" },
  { start: "192.168.0.0", end: "192.168.255.255" },
  { start: "127.0.0.0", end: "127.255.255.255" },
  { start: "169.254.0.0", end: "169.254.255.255" }
];

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIp(ip: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const value = ipToInt(ip);
  return PRIVATE_RANGES.some((range) => {
    const start = ipToInt(range.start);
    const end = ipToInt(range.end);
    return value >= start && value <= end;
  });
}

export async function safeFetch(urlRaw: string, options?: RequestInit, settings?: { allowAnyPublicDomain?: boolean; maxChars?: number }) {
  const url = new URL(urlRaw);

  if (!config.ALLOW_INSECURE_HTTP && url.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }

  if (!settings?.allowAnyPublicDomain && !isAllowedDomain(url.hostname)) {
    throw new Error("Domain not allowed");
  }

  if (config.BLOCK_PRIVATE_IPS) {
    const lookup = await dns.lookup(url.hostname, { all: true });
    for (const record of lookup) {
      if (isPrivateIp(record.address)) {
        throw new Error("Private IPs are blocked");
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "manual"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const maxChars = settings?.maxChars ?? 5000;
    if (text.length > maxChars) {
      return text.slice(0, maxChars) + "\n...[truncado]";
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function isAllowedDomain(hostname: string): boolean {
  if (config.ALLOWED_DOMAINS.length === 0) return false;
  return config.ALLOWED_DOMAINS.some((domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
}
