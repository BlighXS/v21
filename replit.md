# Fawer'Bot

## Overview

Discord bot extracted from the uploaded `Faw` zip and promoted to the project root. The active app is now a TypeScript Node.js bot with slash commands, prefix commands, admin controls, server backup/setup helpers, a local dashboard, Spotify search support, and AI responses through Replit-provisioned OpenAI-compatible integration.

The previous `codespace-livre/` directory remains as a neutral free workspace with no predefined language, framework, or dependencies.

## Stack

- **Runtime**: Node.js 24
- **Package manager**: pnpm
- **Language**: TypeScript
- **Discord SDK**: discord.js 14
- **Web dashboard**: Express 4
- **Logging**: Pino
- **AI**: OpenAI-compatible Replit AI integration using `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`

## Key Commands

- `pnpm install` — install dependencies
- `pnpm run dev` — run the Discord bot with tsx
- `pnpm run build` — compile TypeScript to `dist/`
- `pnpm run start` — run compiled bot

## Required Environment

- `DISCORD_TOKEN` is required before the bot can log in.
- `DISCORD_CLIENT_ID` is recommended for slash command registration.
- `DISCORD_GUILD_ID` is recommended during development for fast guild command registration.
- `DASHBOARD_TOKEN` enables the Express dashboard.

Optional configuration is documented in `.env.example`.
