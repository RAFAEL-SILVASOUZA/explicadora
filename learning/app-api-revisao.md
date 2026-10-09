# app-api-revisao
path: app/api/revisao
files: app/api/revisao/route.ts, [id]/route.ts, [id]/responder, [id]/avancar, [id]/finalizar, [id]/reiniciar
lines: 211
deps: db-schema, lib-llm, lib-pdf, lib-imagem, lib-constantes, lib-types
exports: POST, GET
does: Creates revisao from text/PDF/images; grades, advances, scores, resets answers per session.
roles: aluno
db: sessoes, questoes, respostas
links: app-api-sessoes, db-schema, lib-llm, lib-prompts, app-estudar-id, app-resultado-id, comp-revisao-form
