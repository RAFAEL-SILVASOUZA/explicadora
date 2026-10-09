# comp-revisao-form
path: components/RevisaoForm.tsx
files: components/RevisaoForm.tsx, components/RevisaoForm.test.tsx
lines: 248
deps: react, next/navigation, lucide-react, lib/constantes (MAX_IMAGENS), components/LoadingQuestoes
exports: RevisaoForm (default)
does: Client form collecting text plus image/PDF files, posts multipart to API then redirects to study page.
roles: student
db: sessoes, questoes (indirect, via POST /api/revisao)
links: app-revisao, app-home, app-api-revisao, comp-questao-ui, lib-constantes, app-estudar-id
