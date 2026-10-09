# db-schema
path: lib/db.ts
files: lib/db.ts
lines: 136
deps: lib-types
exports: getDb, createSessao, getSessao, getQuestoes, getRespostas, createQuestoes, createResposta, listarSessoes, getSessaoComQuestoes, createQuestoesApos, limparRespostas, getScore
does: Lazy SQLite connection, creates tables, CRUD for sessions, questions, answers, score
roles: student
db: sessoes, questoes, respostas
links: lib-types, app-api-sessoes, app-api-revisao, app-resultado-id, app-revisao
