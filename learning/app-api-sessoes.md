# app-api-sessoes
path: app/api/sessoes
files: app/api/sessoes/route.ts
lines: 7
deps: next/server, lib/db
exports: GET
does: Lists all study sessions, newest first, as JSON for the home list.
roles: aluno
db: sessoes
links: app-api-revisao, db-schema, app-home, app-revisao
