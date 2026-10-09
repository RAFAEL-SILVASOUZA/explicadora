# root-config
path: package.json
files: package.json, next.config.js, tsconfig.json, vitest.config.ts, tailwind.config.js, postcss.config.js, Dockerfile, docker-compose.yml
lines: 199
deps: none
exports: scripts dev/build/start/test, TS paths @/*, vitest jsdom, tailwind theme, docker compose
does: Defines deps, scripts, TS and test config, kid theme tokens, containerized deploy with LLM env vars.
roles: developer, DevOps
db: none (mounts data/ and uploads/ volumes for SQLite)
links: lib-llm, lib-imagem, lib-pdf, db-schema, app-shell, root-pwa