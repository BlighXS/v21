# Fawer'Bot

Bot Discord em TypeScript com comandos slash, comandos por prefixo, permissões administrativas, treinamento de identidade, backup/restauração de servidor, dashboard local e respostas com IA.

## Configuração

Crie as variáveis de ambiente no Replit Secrets ou copie `.env.example` para `.env` em desenvolvimento local.

Obrigatórias:

- `DISCORD_TOKEN`

Recomendadas:

- `DISCORD_CLIENT_ID` para registrar comandos slash
- `DISCORD_GUILD_ID` para registrar comandos no servidor de teste rapidamente
- `ADMIN_ROLE_IDS` com IDs de cargos admin separados por vírgula
- `RESTART_ROLE_IDS` com IDs de cargos autorizados a reiniciar o bot
- `DASHBOARD_TOKEN` para ativar o dashboard web

O comando `;fwp` usa a integração de IA configurada no projeto, sem precisar de chave própria da OpenAI.

## Rodar

```bash
pnpm install
pnpm run dev
```

## Build

```bash
pnpm run build
pnpm run start
```

## Comandos principais

- `/ping` e `;ping`
- `/admin status` e `;admin status`
- `;trainer`
- `;svrc`
- `;backup`
- `;fwp <pergunta>`
- `;net fetch <url>` para admins

## Dashboard

Defina `DASHBOARD_TOKEN` para ativar o painel web. Por padrão ele escuta em `0.0.0.0:3000`, compatível com a prévia do Replit.
