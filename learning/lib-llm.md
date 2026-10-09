# lib-llm
path: lib/llm.ts
files: lib/llm.ts, lib/llm.test.ts
lines: 390
deps: @langchain/openai, zod, lib/types, lib/prompts
exports: ImagemProcessada, embaralharOpcoes, gerarQuestoes, gerarQuestoesFocadas, avaliarResposta, gerarVeredito, ModoFocado
does: Calls local OpenAI-compatible LLM with Zod tool schemas, retries, shuffles options, checks leaked hints.
roles: aluno
db: none
links: lib-prompts, lib-types, lib-imagem, lib-pdf, app-api-revisao, app-api-sessoes, app-resultado-id, comp-questao-ui
