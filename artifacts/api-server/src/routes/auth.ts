import { Router } from "express";
import { randomBytes } from "crypto";
import { getSession, setSession, clearSession, type SessionData } from "../lib/session.js";

const router = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";

function getRedirectUri(req: { protocol: string; headers: { host?: string } }): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}/api/auth/discord/callback`;
  return `${req.protocol}://${req.headers.host}/api/auth/discord/callback`;
}

router.get("/discord", (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    res.status(503).json({ error: "Discord OAuth não configurado. Adicione DISCORD_CLIENT_SECRET." });
    return;
  }
  const redirectUri = getRedirectUri(req);
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get("/discord/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    res.redirect("/?auth=error");
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) throw new Error("Token exchange failed");
    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) throw new Error("User fetch failed");
    const user = (await userRes.json()) as {
      id: string;
      username: string;
      global_name?: string;
      avatar?: string;
    };

    setSession(res, {
      type: "discord",
      discordId: user.id,
      discordUsername: user.username,
      discordGlobalName: user.global_name ?? null,
      discordAvatar: user.avatar ?? null,
    });

    res.redirect("/?auth=success");
  } catch {
    res.redirect("/?auth=error");
  }
});

router.get("/me", (req, res) => {
  const session = getSession(req);

  if (!session) {
    res.json({ authenticated: false, guest: false, noSession: true });
    return;
  }

  if (session.type === "guest") {
    res.json({
      authenticated: false,
      guest: true,
      guestId: session.guestId,
      guestMessagesLeft: Math.max(0, 5 - (session.guestCount ?? 0)),
    });
    return;
  }

  const ownerIds = (process.env.OWNER_IDS || process.env.OWNER_ID || "").split(",").map((s) => s.trim());
  const isOwner = ownerIds.includes(session.discordId ?? "");

  res.json({
    authenticated: true,
    guest: false,
    discordId: session.discordId,
    username: session.discordUsername,
    globalName: session.discordGlobalName,
    avatar: session.discordAvatar,
    isOwner,
  });
});

router.post("/guest", (req, res) => {
  const existing = getSession(req);
  if (existing) {
    res.json({ success: true });
    return;
  }
  const session: SessionData = {
    type: "guest",
    guestId: randomBytes(16).toString("hex"),
    guestCount: 0,
  };
  setSession(res, session);
  res.json({ success: true, guestMessagesLeft: 5 });
});

router.post("/logout", (req, res) => {
  clearSession(res);
  res.json({ success: true });
});

export default router;
