import express from "express";
import type { Client, Guild, TextBasedChannel } from "discord.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { searchTracks } from "../music/spotify.js";

const MAX_MESSAGE = 1900;

export function startDashboard(client: Client) {
  if (!config.DASHBOARD_TOKEN) {
    logger.warn("Dashboard disabled: DASHBOARD_TOKEN not set");
    return;
  }

  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/", (_req, res) => {
    res.type("html").send(getHtml());
  });

  app.get("/api/channels", async (req, res) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

    const guild = await resolveGuild(client);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const textChannels = guild.channels.cache
      .filter((c) => c.isTextBased() && c.isTextBased())
      .map((c) => ({ id: c.id, name: c.name, type: "text" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const voiceChannels = guild.channels.cache
      .filter((c) => c.type === 2 || c.type === 13)
      .map((c) => ({ id: c.id, name: c.name, type: "voice" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ guild: { id: guild.id, name: guild.name }, channels: textChannels, voiceChannels });
  });

  app.post("/api/send", async (req, res) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });

    const { channelId, content } = req.body ?? {};
    if (!channelId || !content || typeof content !== "string") {
      return res.status(400).json({ error: "Missing channelId or content" });
    }

    const guild = await resolveGuild(client);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const channel = guild.channels.cache.get(channelId) as TextBasedChannel | undefined;
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ error: "Channel not found or not text" });
    }

    const safe = content.length > MAX_MESSAGE ? content.slice(0, MAX_MESSAGE) + "..." : content;

    await channel.send(safe);
    res.json({ ok: true });
  });

  app.get("/api/spotify/search", async (req, res) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.status(400).json({ error: "Missing q" });

    try {
      const tracks = await searchTracks(q, 8);
      res.json({ tracks });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/spotify/play", async (req, res) => {
    res.status(503).json({ error: "Voice preview desabilitado" });
  });

  app.listen(Number(config.DASHBOARD_PORT), config.DASHBOARD_BIND, () => {
    logger.info({
      bind: config.DASHBOARD_BIND,
      port: config.DASHBOARD_PORT
    }, "Dashboard online");
  });
}

function isAuthorized(req: express.Request): boolean {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token === config.DASHBOARD_TOKEN;
}

async function resolveGuild(client: Client): Promise<Guild | null> {
  if (config.DASHBOARD_GUILD_ID) {
    return client.guilds.cache.get(config.DASHBOARD_GUILD_ID) ?? null;
  }
  const first = client.guilds.cache.first();
  return first ?? null;
}

function getHtml(): string {
  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fawer'Bot Dashboard</title>
  <style>
    :root { --bg:#0b0f14; --fg:#e7eef7; --muted:#8aa0b8; --card:#121926; --accent:#1db954; --accent2:#19a34a; }
    body { margin:0; font-family: "Space Grotesk", system-ui, sans-serif; background: radial-gradient(1200px 800px at 80% -10%, #17322b, #0b0f14); color: var(--fg); }
    .wrap { max-width: 900px; margin: 40px auto; padding: 24px; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    p { color: var(--muted); }
    .card { background: var(--card); border: 1px solid #1f2a44; border-radius: 12px; padding: 16px; margin-top: 16px; }
    label { display:block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    input, select, textarea, button { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #2a3654; background:#0f1522; color: var(--fg); }
    button { background: var(--accent); color: #001b0c; font-weight: 700; border: none; cursor: pointer; transition: transform .08s ease, filter .08s ease; }
    button:hover { filter: brightness(1.05); transform: translateY(-1px); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .log { font-size: 12px; color: var(--muted); white-space: pre-wrap; }
    .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; background:#1b263d; color: var(--muted); font-size: 11px; }
    .tracks { display: grid; gap: 8px; margin-top: 12px; }
    .track { display:flex; align-items:center; justify-content:space-between; gap: 12px; padding: 10px; border: 1px solid #203042; border-radius: 10px; }
    .track-info { display:flex; flex-direction:column; gap: 2px; }
    .track-title { font-weight: 700; }
    .track-meta { color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Fawer'Bot Console</h1>
    <p>Envio de mensagens como bot, com controle por token.</p>

    <div class="card">
      <div class="row">
        <div>
          <label>Token do Dashboard</label>
          <input id="token" type="password" placeholder="Cole o DASHBOARD_TOKEN" />
        </div>
        <div>
          <label>Canal</label>
          <select id="channels"></select>
        </div>
      </div>
      <div style="margin-top:12px;">
        <label>Mensagem</label>
        <textarea id="msg" rows="6" placeholder="Digite a mensagem..."></textarea>
      </div>
      <div style="margin-top:12px;">
        <button id="send">Enviar</button>
      </div>
      <div style="margin-top:12px;" class="log" id="log">Pronto.</div>
    </div>

    <div class="card">
      <h2>Spotify</h2>
      <p>Busca musicas e abre links oficiais do Spotify.</p>
      <div class="row">
        <div>
          <label>Canais de voz detectados</label>
          <select id="voiceChannels"></select>
        </div>
        <div>
          <label>Pesquisar</label>
          <input id="q" placeholder="Digite o nome da musica" />
        </div>
      </div>
      <div style="margin-top:12px;">
        <button id="search">Buscar</button>
      </div>
      <div class="tracks" id="tracks"></div>
    </div>

    <div class="card">
      <span class="badge">Seguranca</span>
      <p>Este painel exige DASHBOARD_TOKEN. Use um token forte e compartilhe apenas com admins.</p>
    </div>
  </div>

  <script>
    const log = (msg) => { document.getElementById('log').textContent = msg; };

    async function loadChannels() {
      const token = document.getElementById('token').value.trim();
      if (!token) return log('Informe o token para carregar canais.');
      const res = await fetch('/api/channels', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return log('Falha ao carregar canais: ' + res.status);
      const data = await res.json();
      const select = document.getElementById('channels');
      const voiceSelect = document.getElementById('voiceChannels');
      select.innerHTML = '';
      for (const ch of data.channels) {
        const opt = document.createElement('option');
        opt.value = ch.id; opt.textContent = ch.name;
        select.appendChild(opt);
      }
      voiceSelect.innerHTML = '';
      for (const ch of data.voiceChannels) {
        const opt = document.createElement('option');
        opt.value = ch.id; opt.textContent = ch.name;
        voiceSelect.appendChild(opt);
      }
      log('Canais carregados (' + data.guild.name + ').');
    }

    document.getElementById('token').addEventListener('change', loadChannels);

    document.getElementById('send').addEventListener('click', async () => {
      const token = document.getElementById('token').value.trim();
      const channelId = document.getElementById('channels').value;
      const content = document.getElementById('msg').value.trim();
      if (!token || !channelId || !content) return log('Preencha token, canal e mensagem.');
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ channelId, content })
      });
      if (!res.ok) return log('Falha ao enviar: ' + res.status);
      log('Mensagem enviada.');
    });

    document.getElementById('search').addEventListener('click', async () => {
      const token = document.getElementById('token').value.trim();
      const q = document.getElementById('q').value.trim();
      if (!token || !q) return log('Informe token e pesquisa.');
      const res = await fetch('/api/spotify/search?q=' + encodeURIComponent(q), {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return log('Falha na busca: ' + res.status);
      const data = await res.json();
      const list = document.getElementById('tracks');
      list.innerHTML = '';
      if (!data.tracks.length) {
        list.textContent = 'Sem resultados.';
        return;
      }
      for (const t of data.tracks) {
        const row = document.createElement('div');
        row.className = 'track';
        const info = document.createElement('div');
        info.className = 'track-info';
        const title = document.createElement('div');
        title.className = 'track-title';
        title.textContent = t.name;
        const meta = document.createElement('div');
        meta.className = 'track-meta';
        meta.textContent = t.artists + ' — ' + t.album;
        info.appendChild(title);
        info.appendChild(meta);
        const btn = document.createElement('button');
        btn.textContent = 'Abrir';
        btn.addEventListener('click', () => {
          window.open(t.externalUrl, '_blank', 'noopener,noreferrer');
        });
        row.appendChild(info);
        row.appendChild(btn);
        list.appendChild(row);
      }
      log('Resultados carregados.');
    });
  </script>
</body>
</html>`;
}
