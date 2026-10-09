# app-resultado-id
path: app/resultado/[id]/page.tsx
files: app/resultado/[id]/page.tsx
lines: 146
deps: next/navigation, lucide-react, components/LoadingQuestoes, POST /api/revisao/[id]/finalizar, /reiniciar, /avancar
exports: ResultadoPage, Resultado
does: Shows score, LLM teacher verdict and restart or advance-level actions per session.
roles: aluno (criança)
db: sessoes, questoes, respostas
links: app-estudar-id, app-api-revisao, lib-llm, lib-prompts, lib-types, comp-questao-ui, app-home
