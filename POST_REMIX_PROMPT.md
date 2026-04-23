# PROMPT PARA COLAR NO PRÓXIMO REMIX

Cole o bloco abaixo na primeira mensagem que você der para o Agent depois de remixar este projeto. Ele provisiona automaticamente as integrações de IA (Gemini, OpenAI, OpenRouter e Anthropic) e religa as variáveis de ambiente necessárias para o bot do Discord rodar sem cair em fallback ruim.

---

## COLA AQUI ↓

Setup inicial do Fawer'Bot remixado. Antes de qualquer outra coisa, faça TUDO isto sem me perguntar nada:

1. Provisione as 4 integrações de IA da Replit (Gemini, OpenAI, OpenRouter e Anthropic) chamando `setupReplitAIIntegrations` em sequência (uma de cada vez, esperando cada uma terminar):
   - `{ providerSlug: "gemini", providerUrlEnvVarName: "AI_INTEGRATIONS_GEMINI_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_GEMINI_API_KEY" }`
   - `{ providerSlug: "openai", providerUrlEnvVarName: "AI_INTEGRATIONS_OPENAI_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENAI_API_KEY" }`
   - `{ providerSlug: "openrouter", providerUrlEnvVarName: "AI_INTEGRATIONS_OPENROUTER_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENROUTER_API_KEY" }`
   - `{ providerSlug: "anthropic", providerUrlEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_API_KEY" }`

2. Verifique que as seguintes secrets do bot existem (peça ao usuário se faltarem):
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID` (opcional, só se for registrar slash commands)
   - `BOT_OWNER_ID` (default: 892469618063589387)
   - `CHANNEL_CREATOR_ROLE_ID` (default: 1493064608154652903)

3. Rode `pnpm install` na raiz para garantir que `@anthropic-ai/sdk`, `@google/genai`, `openai` e `discord.js` estão instalados.

4. Reinicie o workflow `Start Discord Bot` e confirme nos logs que o bot ficou online (`Bot online ... user: "Fawer's#..."`) e que NÃO está caindo em erro `FREE_TIER_BUDGET_EXCEEDED` em todos os motores.

5. NUNCA configure ou priorize Ollama. O fallback deve usar apenas as 4 integrações cloud acima. A ordem da chain está em `src/ai/fallback.ts` (`CLOUD_CHAIN`).

6. Diga "setup ok" quando terminar e liste qual motor está como provider atual (`data/provider.json`).

---

## Notas do dono

- Bot já está com tudo implementado: cargos, canais, permissões, codespace, memória, presence intent, fallback robusto entre as 4 IAs.
- Se quota de uma IA estourar, o sistema cai para a próxima automaticamente — não é mais necessário Ollama.
- O codespace da IA fica em `src/fawers_codespaces/`. Comandos novos do bot vão lá e são recarregados via ação `cs_reload_commands`.
