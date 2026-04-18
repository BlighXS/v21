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

## Integração V5 — OpenRouter

### Instrução para o agente de IA do Replit (OpenRouter)

> "Configure a integração nativa do Replit com o OpenRouter. Chame `setupReplitAIIntegrations` com `providerSlug: 'openrouter'`, `providerUrlEnvVarName: 'AI_INTEGRATIONS_OPENROUTER_BASE_URL'` e `providerApiKeyEnvVarName: 'AI_INTEGRATIONS_OPENROUTER_API_KEY'`. Depois reinicie o bot."

---

## O que cada integração faz

- Não exige chave de API própria
- O uso é cobrado nos créditos Replit da sua conta
- As variáveis de ambiente são provisionadas automaticamente
- Se um motor falhar, o sistema usa **fallback automático** para o próximo disponível (nunca cai no Motor Beta)

---

## Modelos configurados

| Botão no `;setup fwp` | Motor interno | Custo |
|---|---|---|
| Motor Beta | `llama3.2:1b` (local via Ollama) | Sem custo externo |
| FAWER V2 | Gemini (integração Gemini) | Créditos Replit |
| FAWER V3 | Gemini avançado (integração Gemini) | Créditos Replit |
| FAWER V4 | Motor GPT (integração OpenAI) | Créditos Replit |
| FAWER V5 | Motor alternativo (integração OpenRouter) | Créditos Replit |

---

## Fallback automático

O sistema tenta os motores nesta ordem ao falhar: **V3 → V2 → V4 → V5**. Nunca cai no Motor Beta automaticamente.

---

## Observações

- O Motor Beta (Ollama) funciona sem configuração extra, mas você precisa baixar o modelo rodando `ollama pull llama3.2:1b` no shell
- A seleção de versão é **global** — o que você definir no `;setup fwp` vale para todos os usuários do servidor
- Não há nomes de modelos externos expostos nos botões
