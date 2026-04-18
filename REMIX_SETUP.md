# Setup após Remix

## Integração Gemini — V2 e V3

Após fazer o remix deste projeto, o código já está pronto, mas você precisa ativar as integrações manualmente.

### Instrução para o agente de IA do Replit (Gemini)

> "Configure a integração nativa do Replit com o Gemini. Chame `setupReplitAIIntegrations` com `providerSlug: 'gemini'`, `providerUrlEnvVarName: 'AI_INTEGRATIONS_GEMINI_BASE_URL'` e `providerApiKeyEnvVarName: 'AI_INTEGRATIONS_GEMINI_API_KEY'`. Depois reinicie o bot."

---

## Integração OpenAI — V4

### Instrução para o agente de IA do Replit (OpenAI)

> "Configure a integração nativa do Replit com o OpenAI. Chame `setupReplitAIIntegrations` com `providerSlug: 'openai'`, `providerUrlEnvVarName: 'AI_INTEGRATIONS_OPENAI_BASE_URL'` e `providerApiKeyEnvVarName: 'AI_INTEGRATIONS_OPENAI_API_KEY'`. Depois reinicie o bot."

---

## Integração DeepSeek — V5

### Instrução para o agente de IA do Replit (DeepSeek)

> "Configure a integração nativa do Replit com o DeepSeek. Chame `setupReplitAIIntegrations` com `providerSlug: 'deepseek'`, `providerUrlEnvVarName: 'AI_INTEGRATIONS_DEEPSEEK_BASE_URL'` e `providerApiKeyEnvVarName: 'AI_INTEGRATIONS_DEEPSEEK_API_KEY'`. Depois reinicie o bot."

---

## O que cada integração faz

- Não exige chave de API própria do Google, OpenAI ou DeepSeek
- O uso é cobrado nos créditos Replit da sua conta
- As variáveis de ambiente são provisionadas automaticamente

---

## Modelos configurados

| Botão no `;setup fwp` | Modelo | Custo |
|---|---|---|
| Beta | `llama3.2:1b` (roda local via Ollama) | Sem custo externo |
| FAWER_V2.01 | `gemini-2.5-flash` (integração Gemini) | Créditos Replit |
| FAWER Flash V3.0 | `gemini-3-flash-preview` (integração Gemini) | Créditos Replit |
| FAWER V4 (ChatGPT) | `gpt-5.2` (integração OpenAI) | Créditos Replit |
| FAWER V5 (DeepSeek) | `deepseek-chat` (integração DeepSeek) | Créditos Replit |

---

## Observações

- O modelo Beta (Ollama) funciona sem configuração extra, mas você precisa baixar o modelo rodando `ollama pull llama3.2:1b` no shell
- A seleção de modelo é **global** — o que você definir no `;setup fwp` vale para todos os usuários do servidor
- Não há fallback entre modelos: se o modelo configurado falhar, o bot reporta o erro diretamente
