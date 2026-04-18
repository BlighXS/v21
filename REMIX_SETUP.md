# Setup após Remix

> **Leia antes de tudo:** após fazer o remix deste projeto, o código já está pronto. Você só precisa rodar o prompt abaixo no agente de IA do Replit para ativar as integrações. Sem isso, a Fawer's responde "Deu erro aqui, tenta de novo." para toda mensagem.

---

## Prompt único — cole este no agente do Replit

> Configure as três integrações nativas de IA do Replit para este projeto. Você deve usar o sandbox JavaScript (code_execution) e chamar `setupReplitAIIntegrations` três vezes de forma **sequencial** (espere cada chamada terminar antes de começar a próxima):
>
> 1. `setupReplitAIIntegrations({ providerSlug: "gemini", providerUrlEnvVarName: "AI_INTEGRATIONS_GEMINI_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_GEMINI_API_KEY" })`
> 2. `setupReplitAIIntegrations({ providerSlug: "openai", providerUrlEnvVarName: "AI_INTEGRATIONS_OPENAI_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENAI_API_KEY" })`
> 3. `setupReplitAIIntegrations({ providerSlug: "openrouter", providerUrlEnvVarName: "AI_INTEGRATIONS_OPENROUTER_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENROUTER_API_KEY" })`
>
> Confirme que cada chamada retornou `"success": true` antes de continuar. Depois de provisionar as três, reinicie o workflow "Start Discord Bot". Não faça mais nada além disso — o código já está pronto.

---

## Por que o prompt acima funciona

O agente precisa rodar `setupReplitAIIntegrations` via sandbox JavaScript interno do Replit. Simplesmente mencionar o nome da função em texto não resolve — ele precisa executar no sandbox. O prompt acima instrui isso de forma explícita.

---

## O que cada integração faz

- Não exige chave de API própria
- O uso é cobrado nos créditos Replit da sua conta
- As variáveis de ambiente são provisionadas automaticamente pelo Replit
- Se um motor falhar, o sistema usa **fallback automático** (V5 → V3 → V2 → V4)

---

## Motores configurados

| Botão no `;setup fwp` | Motor interno | Custo |
|---|---|---|
| Motor Beta | `llama3.2:1b` (local via Ollama) | Sem custo externo |
| FAWER V2 | Gemini Flash (integração Gemini) | Créditos Replit |
| FAWER V3 | Gemini avançado (integração Gemini) | Créditos Replit |
| FAWER V4 | GPT (integração OpenAI) | Créditos Replit |
| FAWER V5 | DeepSeek via OpenRouter (integração OpenRouter) | Créditos Replit |

---

## Fallback automático

Ao falhar, o sistema tenta nesta ordem: **V5 → V3 → V2 → V4**. O Motor Beta nunca é usado automaticamente.

---

## Observações

- O Motor Beta (Ollama) funciona sem configuração extra, mas você precisa baixar o modelo rodando `ollama pull llama3.2:1b` no shell
- A seleção de versão é **global** — o que você definir no `;setup fwp` vale para todos os usuários do servidor
- Nomes de modelos externos não são expostos nos botões
- Se após rodar o prompt ainda der erro, rode o prompt de novo — às vezes o Replit precisa de uma segunda tentativa para provisionar as credenciais
