import type { Request, Response, NextFunction } from "express";
import { createHmac, randomBytes } from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "fawer-secret-key-change-in-prod";
const COOKIE_NAME = "fawer_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export interface SessionData {
  type: "guest" | "discord";
  guestId?: string;
  guestCount?: number;
  discordId?: string;
  discordUsername?: string;
  discordAvatar?: string | null;
  discordGlobalName?: string | null;
}

function sign(payload: string): string {
  const hmac = createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  return hmac.digest("hex");
}

function encode(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function decode(token: string): SessionData | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    if (sign(payload) !== sig) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as SessionData;
  } catch {
    return null;
  }
}

export function setSession(res: Response, data: SessionData): void {
  res.cookie(COOKIE_NAME, encode(data), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function getSession(req: Request): SessionData | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  return decode(token);
}

export function ensureGuestSession(req: Request, res: Response): SessionData {
  const existing = getSession(req);
  if (existing) return existing;
  const session: SessionData = {
    type: "guest",
    guestId: randomBytes(16).toString("hex"),
    guestCount: 0,
  };
  setSession(res, session);
  return session;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (!session || session.type !== "discord") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
