# Setup após Remix

## Integração Gemini (V2 e V3)

Após fazer o remix deste projeto, o código já está pronto, mas você precisa ativar a integração Gemini manualmente para os modelos V2 e V3 funcionarem.

### Instrução para o agente de IA do Replit

Cole o seguinte para o agente configurar tudo automaticamente:

> "Configure a integração nativa do Replit com o Gemini. Chame `setupReplitAIIntegrations` com `providerSlug: 'gemini'`, `providerUrlEnvVarName: 'AI_INTEGRATIONS_GEMINI_BASE_URL'` e `providerApiKeyEnvVarName: 'AI_INTEGRATIONS_GEMINI_API_KEY'`. Depois reinicie o bot."

### O que isso faz

- Provisiona automaticamente as variáveis de ambiente `AI_INTEGRATIONS_GEMINI_BASE_URL` e `AI_INTEGRATIONS_GEMINI_API_KEY`
- Não exige chave de API própria do Google
- O uso é cobrado nos créditos Replit da sua conta

### Modelos configurados

| Comando no Discord | Modelo |
|---|---|
| `;setup fwp` → Beta | `llama3.2:1b` (roda local, sem custo) |
| `;setup fwp` → FAWER_V2.01 | `gemini-2.5-flash` (usa créditos Replit) |
| `;setup fwp` → FAWER Flash V3.0 | `gemini-3-flash-preview` (usa créditos Replit) |

### Observações

- O modelo Beta (Ollama) funciona sem nenhuma configuração extra, mas você precisa baixar o modelo rodando `ollama pull llama3.2:1b` no shell
- A seleção de modelo é **global** — o que você definir no `;setup fwp` vale para todos os usuários do servidor
- Não há fallback entre modelos: se o modelo configurado falhar, o bot reporta o erro sem trocar de modelo automaticamente
