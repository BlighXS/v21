# Fawer'Bot

## Overview

Discord bot completo em PT-BR, desenvolvido em TypeScript com Discord.js v14. Inclui slash commands, prefix commands, sistema de backup de servidor, setup estrutural, IA treinável, busca no Spotify, dashboard web, boas-vindas automáticas, canal de logs e muito mais.

Ambiente de configuração: variáveis lidas do arquivo `faw.env` na raiz (prioridade) ou `.env` (fallback).

## Stack

- **Runtime**: Node.js 24
- **Gerenciador de pacotes**: pnpm (monorepo)
- **Linguagem**: TypeScript
- **Discord SDK**: discord.js 14
- **Dashboard web**: Express 4
- **Logs**: Pino + pino-pretty
- **IA**: Gemini, OpenAI e OpenRouter via integrações nativas do Replit
- **Memória IA**: ledger interno em `data/memory/global_memorial.jsonl`, perfil em `data/memory/bot_profile.json` e histórico por usuário/canal em `data/memory/*.json`
- **Música**: Spotify API (Client Credentials Flow), YouTube via `play-dl` e voz Discord via `@discordjs/voice`

## Comandos Disponíveis

### Slash Commands (`/`)
| Comando | Descrição |
|---|---|
| `/ping` | Latência WebSocket e roundtrip |
| `/apresentacao` | Apresentação completa do bot |
| `/ajuda` | Lista todos os comandos |
| `/info` | Informações detalhadas do servidor |
| `/usuario [@alvo]` | Perfil de um usuário |
| `/admin status` | Status, métricas e configurações do bot (admin) |
| `/admin restart` | Reinicia o bot (admin) |
| `/net fetch <url>` | Requisição HTTP segura (admin) |

### Prefix Commands (padrão: `;`)
| Comando | Descrição |
|---|---|
| `;ping` | Latência |
| `;ajuda` | Ajuda dos comandos |
| `;info` | Info do servidor |
| `;usuario [@alvo]` | Perfil de usuário |
| `;spf <pesquisa>` | Busca músicas no Spotify |
| `;fw music <nome>` | Toca música do YouTube na call do usuário |
| `;fw music queue` | Mostra fila de músicas |
| `;fw music skip` | Pula a música atual |
| `;fw music stop` | Para a música e sai da call |
| `;fwp <pergunta>` | Consulta IA Fawer |
| `;fwp <url/pergunta>` | Consulta IA com acesso seguro a páginas HTTPS públicas |
| `;trainer` | Inicia treinamento da IA |
| `;backup server <nome>` | Cria backup do servidor |
| `;backup list` | Lista backups |
| `;backup restore` | Restaura um backup |
| `;svrc` | Setup estrutural do servidor |
| `;admin status` | Status do bot |
| `;restart` | Reinicia o bot |
| `;net fetch <url>` | HTTP seguro (admin) |

## Autonomia e Memória da Fawers

- Todo comando prefixado, ordem recebida pelo `;fwp`, resposta de IA, ação executada e fetch de internet é registrado no memorial interno em `data/memory/global_memorial.jsonl`.
- O prompt da IA recebe a biografia interna, preferências, eventos recentes, cargos/canais do servidor e snapshot operacional do Discord.
- A IA pode solicitar ações estruturadas via FWP:
  - `create_category`: cria ou garante categorias quando o solicitante tem o cargo `1493064608154652903` ou permissão de administrador, e o bot tem `Gerenciar Canais`.
  - `create_channel`: cria canais de texto/voz/categoria, inclusive dentro de uma categoria informada, criando a categoria se necessário.
  - `move_channel`: move canais existentes para uma categoria, criando a categoria se necessário.
  - `set_biography`: altera a biografia interna em `data/memory/bot_profile.json` e atualiza a presença do bot.
  - `remember`: registra uma memória/preferência persistente no perfil interno.
- URLs HTTPS em mensagens `;fwp` são buscadas automaticamente com bloqueio de IPs privados, e o conteúdo é anexado ao contexto da IA.
- Quando a API/modelo fica sobrecarregado, o `;fwp` tenta novamente após 10s. Se continuar falhando por sobrecarga, a pergunta entra em fila persistente em `data/memory/pending_fwp_queue.json` e o bot tenta responder depois no mesmo canal.
- O comando `;fw music <nome>` pesquisa no YouTube e toca na call onde o usuário estiver conectado. A fila de música é mantida em memória por servidor e suporta `queue`, `skip` e `stop`.

## Estrutura do Código

```
src/
├── index.ts                 # Entry point — carrega env, intents, comandos, eventos
├── types.d.ts               # Augmentação do Client do Discord.js
├── commands/
│   ├── ping.ts              # /ping
│   ├── apresentacao.ts      # /apresentacao
│   ├── ajuda.ts             # /ajuda (NOVO)
│   ├── info.ts              # /info (NOVO)
│   ├── usuario.ts           # /usuario (NOVO)
│   └── admin/
│       ├── status.ts        # /admin status | restart
│       └── net.ts           # /net fetch
├── events/
│   ├── ready.ts             # Online, rotação de atividade, backup diário
│   ├── interactionCreate.ts # Slash commands, botões, menus
│   ├── messageCreate.ts     # Prefix commands
│   ├── guildMemberAdd.ts    # Boas-vindas (NOVO)
│   └── guildMemberRemove.ts # Log de saída (NOVO)
├── backup/
│   ├── backup.ts            # Criar/restaurar backup de cargos e canais
│   ├── scheduler.ts         # Backup diário automático
│   └── store.ts             # Persistência em data/backups/
├── training/
│   ├── identity.ts          # Identidade base e 10 perguntas de treinamento
│   ├── store.ts             # Persistência em data/training.json
│   └── trainer.ts           # Fluxo interativo de treinamento
├── music/
│   ├── spotify.ts           # OAuth2 Spotify (Client Credentials)
│   ├── spfCommand.ts        # Interface interativa de busca
│   └── player.ts            # Player YouTube/Discord voice com fila por servidor
├── setup/
│   └── serverSetup.ts       # Setup de 6 cargos e 7 categorias/33 canais
├── web/
│   └── dashboard.ts         # Dashboard Express com envio de mensagens e busca Spotify
└── utils/
    ├── config.ts            # Variáveis de ambiente centralizadas
    ├── format.ts            # buildEmbed, buildEmbedFields, formatUptime, formatBytes
    ├── logChannel.ts        # Envio para canal de log configurado (NOVO)
    ├── logger.ts            # Pino logger
    ├── permissions.ts       # isAdmin, isAdminMember
    ├── net.ts               # safeFetch (anti-SSRF)
    ├── restart.ts           # Reinício gracioso do processo
    ├── types.ts             # SlashCommand, AnySlashCommandBuilder
    ├── events.ts            # BotEvent, registerEvent
    ├── loadCommands.ts      # Auto-load de comandos recursivo
    └── loadEvents.ts        # Auto-load de eventos recursivo
```

## Configuração (faw.env)

```env
DISCORD_TOKEN=          # Obrigatório
DISCORD_CLIENT_ID=      # Recomendado (registro de slash commands)
DISCORD_GUILD_ID=       # Recomendado em dev (comandos de guild são instantâneos)
ADMIN_ROLE_IDS=         # IDs de cargos admin separados por vírgula
RESTART_ROLE_IDS=       # IDs de cargos que podem reiniciar o bot
LOG_CHANNEL_ID=         # ID do canal para logs automáticos
LOG_FILE=logs/bot.log
LOG_LEVEL=info
ENABLE_PREFIX=true
PREFIX=;
DASHBOARD_TOKEN=        # Ativa o dashboard web (qualquer string segura)
DASHBOARD_PORT=3000
DASHBOARD_BIND=0.0.0.0
DASHBOARD_GUILD_ID=
TRAIN_CHANNEL_ID=       # Canal exclusivo para treinamento da IA
SPOTIFY_TEXT_CHANNEL_ID=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
ALLOWED_DOMAINS=        # Domínios permitidos para ;net fetch (separados por vírgula)
ALLOW_INSECURE_HTTP=false
BLOCK_PRIVATE_IPS=true
OPENAI_MODEL=gpt-4o
DATABASE_URL=
AI_INTEGRATIONS_OPENAI_API_KEY=         # Provisionado via integração nativa Replit
AI_INTEGRATIONS_OPENAI_BASE_URL=        # Provisionado via integração nativa Replit
AI_INTEGRATIONS_GEMINI_API_KEY=         # Provisionado via integração nativa Replit
AI_INTEGRATIONS_GEMINI_BASE_URL=        # Provisionado via integração nativa Replit
AI_INTEGRATIONS_OPENROUTER_API_KEY=     # Provisionado via integração nativa Replit
AI_INTEGRATIONS_OPENROUTER_BASE_URL=    # Provisionado via integração nativa Replit
```

> **Nota:** As três integrações de IA (Gemini, OpenAI, OpenRouter) são configuradas via Replit AI Integrations — não é necessário inserir manualmente as chaves. Elas são provisionadas automaticamente pelo sistema Replit.

## Arquivos Críticos (Bloqueados para Escrita pela IA)

A IA pode ler e escrever em qualquer arquivo de `src/`, `artifacts/`, `lib/`, `data/` e arquivos de configuração Nix (`replit.nix`), **exceto** os seguintes que são protegidos:

- `src/index.ts`
- `src/utils/config.ts`
- `src/utils/sysinfo.ts`
- `src/utils/logger.ts`
- `src/utils/restart.ts`
- `src/utils/net.ts`
- `src/utils/permissions.ts`
- Qualquer `package.json`, `tsconfig*.json`, `.env`, `faw.env`, `.replit`, `artifact.toml`, `pnpm-lock.yaml`, `replit.md`

> **Controle total de terminal:** os padrões de bloqueio de shell (`rm -rf`, `shred`, etc.) foram removidos de `src/ai/codespace.ts`. A IA tem acesso irrestrito ao shell via `csShellExec`, e o dono tem acesso direto via `;cmd`.

## Cadeia de Fallback dos Motores de IA

Ordem de prioridade: `gemini-v3` → `deepseek-v5` → `gemini` → `openai-v4`

Provider padrão: **gemini-v3** (quando não configurado manualmente)

## Intents Necessários no Portal do Discord

- `GUILDS`
- `GUILD_VOICE_STATES`
- `GUILD_MEMBERS` (para boas-vindas e saídas)
- `GUILD_MESSAGES` (se `ENABLE_PREFIX=true`)
- `MESSAGE_CONTENT` (se `ENABLE_PREFIX=true`)

## Painel HUB_DM (FAWER AI Web)

Painel de DMs sem login — qualquer um com acesso ao site usa.

- Botão **ACESSO DM** no header rola até `#hub-dm`.
- `GET /api/hub/users` — junta usuários com memória local + todos os membros do guild (`DISCORD_GUILD_ID`), com nome e avatar do Discord. Cache de membros: 60s. Polling no frontend a cada 15s.
- `GET /api/hub/conversation/:userId` — junta `data/memory/{id}.json` + histórico real do canal DM via Discord API (últimas 100 msgs). Dedupe por `role+conteúdo+timestamp(min)`. Polling a cada 5s.
- `POST /api/hub/dm` e `POST /api/hub/dm/image` — envia como o bot.
- Anexos (imagens) são renderizados inline na bolha; outros anexos viram link.
- Auto-scroll só quando o usuário está no fundo da timeline.

## Scripts

- `pnpm run dev` — executa o bot com tsx (desenvolvimento)
- `pnpm run build` — compila TypeScript para `dist/`
- `pnpm run start` — executa o bot compilado
