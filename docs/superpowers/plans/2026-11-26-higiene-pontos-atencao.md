# Higiene dos pontos de atenção — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tratar com cautela os quatro pontos da revisão do projeto: documentar e blindar a coexistência dos dois 007, mover o diário `progress.txt` para `docs/` e levar o Next ao último patch da série 14.2.x.

**Architecture:** Nenhum código de produto muda. Uma migration ganha apenas comentários; o diário troca de lugar via `git mv` (histórico preservado); o Next sobe de patch com `npm install`. Um teste novo no suite de banco fixa os nomes dos dois arquivos 007 para que um rename futuro quebre o suite antes de quebrar o boot.

**Tech Stack:** Next.js 14 (App Router), PostgreSQL via `pg`, Vitest, npm.

**Spec:** `docs/superpowers/specs/2026-11-26-higiene-pontos-atencao-design.md`

## Global Constraints

- NENHUM arquivo em `migrations/` é renomeado ou deletado — o nome é a chave primária da tabela `migrations` e um rename re-aplica a migration.
- Numeração nova de migration, se algum dia ocorrer: `010+`.
- O upgrade é só de patch dentro de `14.2.x`. Nada de React 19, nada de `next@15+`.
- Antes de commitar qualquer task: `npm run test` verde. Tareas que tocam SQL: também `npm run test:db` verde (exige o Postgres de teste do docker-compose em `localhost:5404`, banco `estudo_test`, usuário/senha `estudo`).
- Mensagens de commit no padrão do repo: conventional commits em português (`docs:`, `chore:`), escopo quando fizer sentido.

## Review Focus

- **Boot num banco que já aplicou os dois 007** — esperar "não aplicar nada". É garantido por os nomes dos arquivos não mudarem; o Task 1 fixa isso com teste (nomes na tabela `migrations`).
- **Referências quebradas ao mover o diário** — esperar que nada no repo aponte para `progress.txt`. Já verificado por grep na escrita deste plano (só o próprio spec cita); o Task 2 re-verifica antes de commitar.
- **Patch do Next mudar comportamento em runtime** — esperar suite completo + `next build` verdes na versão nova; o Task 3 registra a versão instalada no commit para rastreabilidade.

---

### Task 1: Blindar e documentar a coexistência dos dois 007

**Files:**
- Modify: `test/db/migrations.test.ts` (acrescentar um teste no fim)
- Modify: `migrations/007_deveres_slides.sql` (comentário no topo, antes do existente)
- Modify: `migrations/007_pagamentos.sql` (comentário no topo, antes do existente)
- Modify: `LESSONS.md` (acrescentar seção no fim do arquivo)

**Interfaces:**
- Consumes: `pool` e `prepararBanco` já exportados por `test/db/helper.ts`.
- Produz: nada para outros tasks.

- [ ] **Step 1: Escrever o teste-guarda que fixa os nomes dos dois 007**

Acrescentar ao fim de `test/db/migrations.test.ts`:

```ts
// Os dois 007 convivem de propósito (nasceram em branches paralelos) e o runner
// rastreia por nome de arquivo. Este teste fixa os nomes: renomear qualquer um
// dos dois quebra o suite de banco antes de quebrar o boot de produção.
test('os dois 007 coexistem pelo nome exato', async () => {
  const { rows } = await pool.query(
    `SELECT name FROM migrations WHERE name LIKE '007_%' ORDER BY name`,
  );
  expect(rows.map(r => r.name)).toEqual([
    '007_deveres_slides.sql',
    '007_pagamentos.sql',
  ]);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que passa**

Este é um teste-guarda do estado atual (não é TDD de comportamento novo): deve passar de primeira.

Run: `npm run test:db -- test/db/migrations.test.ts`
Expected: PASS, incluindo o teste novo. (Com o banco de teste de pé: `docker compose up -d postgres-test`.)

- [ ] **Step 3: Acrescentar os avisos nos dois SQLs**

Prepend no topo de `migrations/007_deveres_slides.sql` (antes do comentário existente):

```sql
-- AVISO: não renomeie este arquivo. Ele coexiste de propósito com
-- 007_pagamentos.sql (nasceram em branches paralelos; o runner ordena por nome
-- e aplica os dois). O nome é a chave da tabela `migrations`: renomear faria o
-- banco re-aplicar este arquivo, que NÃO é idempotente (os RENAME falham se já
-- aplicados) e o boot via instrumentation.ts morreria. Numeração nova: 010+.
```

Prepend no topo de `migrations/007_pagamentos.sql`:

```sql
-- AVISO: não renomeie este arquivo. Ele coexiste de propósito com
-- 007_deveres_slides.sql (nasceram em branches paralelos; o runner ordena por
-- nome e aplica os dois). O nome é a chave da tabela `migrations`: renomear
-- faria o banco re-aplicar o arquivo e deixaria registro órfão. Este SQL é
-- idempotente, mas o nome fica onde está. Numeração nova: 010+.
```

- [ ] **Step 4: Acrescentar a lição ao LESSONS.md**

Acrescentar ao fim de `LESSONS.md`:

```md
## Dois 007 convivem; o nome é a chave
`migrations/` tem `007_deveres_slides.sql` e `007_pagamentos.sql`, e não é bug: o runner (`lib/db/migrate.ts`) ordena por nome de arquivo, aplica cada um em transação e registra na tabela `migrations` pelo **nome exato**. Os dois já rodaram e não dependem um do outro. O perigo é renomear: um nome novo é uma migration inédita para o banco, que re-aplica o arquivo — e o 007 de slides faz `RENAME COLUMN` (não idempotente), matando o boot (`instrumentation.ts`). Regra: arquivo já aplicado nunca é renomeado; numeração nova continua em `010+`. O teste `os dois 007 coexistem pelo nome exato` (test/db/migrations.test.ts) guarda os nomes.
```

- [ ] **Step 5: Rodar os suites**

Run: `npm run test:db -- test/db/migrations.test.ts`
Expected: PASS (os SQLs alterados ainda aplicam de um banco zero, pois `prepararBanco` recria as tabelas; os comentários são inertes no Postgres).

Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations/007_deveres_slides.sql migrations/007_pagamentos.sql LESSONS.md test/db/migrations.test.ts
git commit -m "docs(migrations): documentar coexistencia dos dois 007 e fixar nomes com teste

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Mover o diário `progress.txt` para `docs/`

**Files:**
- Rename: `progress.txt` → `docs/progresso.md`

**Interfaces:**
- Consumes: nada.
- Produz: nada.

- [ ] **Step 1: Re-verificar que nada referencia o arquivo**

Run: `grep -rn "progress\.txt" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.sql' . | grep -v node_modules`
Expected: nenhuma linha (o único texto que cita o nome é o próprio spec/plan em `docs/superpowers/`, que não é código).

- [ ] **Step 2: Mover com histórico preservado**

```bash
git mv progress.txt docs/progresso.md
```

- [ ] **Step 3: Confirmar histórico e estado**

Run: `git log --follow --oneline docs/progresso.md | tail -1`
Expected: um commit de `chore:`/`feat:` antigo (não o commit atual) — histórico seguido através do rename.

Run: `ls progress.txt`
Expected: `No such file or directory` (arquivo saiu da raiz).

- [ ] **Step 4: Rodar os suites e commitar**

Run: `npm run test`
Expected: PASS (mover um .txt não afeta nada; é cinto-e-suspensório do constraint global).

```bash
git commit -m "chore: mover diario de mudancas para docs/progresso.md

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Next ao último patch da série 14.2.x

**Files:**
- Modify: `package.json` (campo `dependencies.next`)
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: nada.
- Produz: nada.

- [ ] **Step 1: Anotar a versão atual**

Run: `npm ls next`
Expected: `next@14.2.5`. Anotar a resposta no passo final.

- [ ] **Step 2: Instalar o último patch da série**

```bash
npm install next@14.2
```

Isso resolve para o maior `14.2.x` publicado. Em `package.json`, o campo sai de `"next": "14.2.5"` (fixo) para `"next": "^14.2.<x>"` — aceitável: o `^` dentro de `14.2` nunca deixa entrar um major.

- [ ] **Step 3: Conferir a versão instalada**

Run: `npm ls next`
Expected: `next@14.2.<x>` com `<x>` > 5. Anotar para a mensagem de commit.

- [ ] **Step 4: Suite completo na versão nova**

Run: `npm run test`
Expected: PASS.

Run: `npm run test:db -- test/db/migrations.test.ts`
Expected: PASS.

- [ ] **Step 5: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros nem novos warnings de deprecação além dos já existentes.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): next 14.2.5 -> 14.2.<x> (correcoes de seguranca da serie)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
