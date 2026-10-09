# Project Index
project: estudo-llm-criancas
stack: Next.js 14 (App Router), TypeScript, better-sqlite3, LangChain + Zod (local OpenAI-compatible LLM), Tailwind, PWA
modules: 21
updated: 2026-10-09

## Modules
app-shell.md | Wraps every page with Nunito font, global styles and service worker registration.
app-home.md | Landing page: revision creation form plus list of past sessions linking to study.
app-revisao.md | Standalone create-revision page rendering the RevisaoForm inside a card layout.
app-estudar-id.md | Question-by-question study flow with grading feedback and redirect to result.
app-resultado-id.md | Shows score, LLM teacher verdict and restart or advance-level actions per session.
app-offline.md | Offline fallback page served by service worker with owl message and reload button.
app-api-revisao.md | Creates revisao from text/PDF/images; grades, advances, scores, resets answers per session.
app-api-sessoes.md | Lists all study sessions, newest first, as JSON for the home list.
db-schema.md | Lazy SQLite connection, creates tables, CRUD for sessions, questions, answers, score
lib-types.md | Shared interfaces mapping LLM output, DB rows and the assembled session aggregate
lib-constantes.md | Single dependency-free constant, max images per LLM vision call, shared server and client
lib-pdf.md | Extracts plain text from a PDF buffer via pdf-parse, for LLM study content
lib-imagem.md | Resizes to 640px, flattens transparency, JPEG-compresses image buffer to base64 for LLM
lib-llm.md | Calls local OpenAI-compatible LLM with Zod tool schemas, retries, shuffles options, checks leaked hints.
lib-prompts.md | Portuguese prompt templates for kid question generation, answer grading, verdict, focused modes.
comp-revisao-form.md | Client form collecting text plus image/PDF files, posts multipart to API then redirects to study page.
comp-questao-ui.md | Renders one question, its options or text answer, correct/wrong feedback, progress bar and loading state.
comp-mascote.md | Inline SVG owl mascot whose eyes, mouth and cheeks change with the humor prop.
comp-canvas.md | Modal HTML canvas for hand-drawing a formula, mouse and touch, returns PNG base64 to caller.
root-pwa.md | Network-first service worker caching root and offline page, serves offline fallback on navigation.
root-config.md | Defines deps, scripts, TS and test config, kid theme tokens, containerized deploy with LLM env vars.

## Quick Nav
app: app-shell, app-home, app-revisao, app-estudar-id, app-resultado-id, app-offline, app-api-revisao, app-api-sessoes
db: db-schema
lib: lib-types, lib-constantes, lib-pdf, lib-imagem, lib-llm, lib-prompts
comp: comp-revisao-form, comp-questao-ui, comp-mascote, comp-canvas
root: root-pwa, root-config
