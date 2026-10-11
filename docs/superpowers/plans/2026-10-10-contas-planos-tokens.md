# Contas, Planos e Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accounts with email/password, Postgres persistence, consumable plan quotas redeemed by admin-generated tokens, JWT auth and an admin area, on top of the existing LLM review core.

**Architecture:** The Next.js 14 monolith keeps its core (LLM generation and grading). A data layer (`pg` pool + SQL migrations + repositories per aggregate), an auth layer (scrypt hash, HS256 JWT, Bearer guard) and a quota layer (single decrement point inside a transaction) wrap it. Every review belongs to an account, and creating a review consumes one unit of balance.

**Tech Stack:** Next.js 14 (App Router), TypeScript, `pg`, `jsonwebtoken`, `node:crypto` scrypt, Docker Compose with Postgres 16, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-contas-planos-tokens-design.md`

## Global Constraints

- Runtime dependencies: only `pg` and `jsonwebtoken` are added. No ORM. No new HTTP framework.
- Dev dependencies added: `tsx` (to run the migration runner), `@types/pg`, `@types/jsonwebtoken`.
- Postgres replaces SQLite. The current `data/estudo.db` is not migrated. `lib/db.ts` is deleted at the end of Task 6.
- Quota is consumable and accumulative per redeemed token. Free gives 3 once, at registration. There is no time-based renewal.
- Plans: `free` 3 reviews / R$ 0, `pro` 20 reviews / R$ 5, `familia` 50 reviews / R$ 15. Prices stored in cents.
- JWT: HS256, 7 days, claims `sub` (account id) and `role`. Delivered as `Authorization: Bearer`, stored in `localStorage` by the client.
- Admin: `role` column on `contas`, admin account seeded from `ADMIN_EMAIL` and `ADMIN_SENHA`. Admin routes require `role='admin'`. The spec says the migration seeds it; the plan seeds it in `lib/db/seed-admin.ts` instead, because a SQL file cannot hash a password. Same result, different place.
- Tokens: single use, 30-day expiry, generated in batches, record of who redeemed and when. Token status is derived by query, never stored.
- HTTP codes: 401 no/invalid JWT, 403 non-admin, 402 balance exhausted, 409 duplicate email or already redeemed, 410 expired token, 404 not found.
- `quantidade` in `movimentos_saldo` is a signed delta: `+3` at registration, `+20`/`+50` at redemption, `-1` at consumption.
- The consumption transaction holds the row lock across the LLM call. Accepted because the lock is per account and the LLM call is the work being paid for.
- Existing tests in `components/RevisaoForm.test.tsx` must keep passing.
- Vitest: existing tests keep `environment: 'jsdom'` (the default in `vitest.config.ts`); every test that touches `next/server` or Postgres uses `// @vitest-environment node` at the top of the file. `test/unit/api.test.ts` stays jsdom because it needs `localStorage`.
- Every command runs from the repo root. PowerShell syntax on Windows.

---

## File Structure

```
migrations/
  001_initial.sql                 schema + seeds (planos, conta admin)
lib/
  db/pool.ts                      pg Pool, reads DATABASE_URL
  db/migrate.ts                   applies migrations in order, table `migrations`
  db/seed-admin.ts                seeds the admin account from ADMIN_EMAIL/ADMIN_SENHA
  repos/contas.ts                 accounts: create, find by email, find by id
  repos/tokens.ts                 batches, redemption, listing with derived status
  repos/revisoes.ts               reviews, questions, answers, score — scoped by account
  repos/movimentos.ts             balance movements, joined with the plan of each redemption
  auth/senha.ts                   scrypt hash and verify
  auth/jwt.ts                     sign and verify HS256
  auth/guard.ts                   reads Bearer header, returns { contaId, role }
  quota.ts                        consumirSaldo(client, contaId) — the only decrement
  client/api.ts                   localStorage token + apiFetch adding Bearer
  types.ts                        shared types (Revisao, Questao, Resposta, Plano)
instrumentation.ts                applies migrations at server startup
test/
  db/helper.ts                    test pool, applies migrations, truncates between cases
  db/contas.test.ts
  db/tokens.test.ts
  db/quota.test.ts
  db/revisoes.test.ts
  unit/senha.test.ts
  unit/jwt.test.ts
  unit/api.test.ts
app/
  login/page.tsx
  cadastro/page.tsx
  conta/page.tsx
  admin/page.tsx
  api/auth/register/route.ts
  api/auth/login/route.ts
  api/conta/route.ts
  api/tokens/resgate/route.ts
  api/admin/tokens/route.ts
  api/sessoes/route.ts            existing, becomes scoped by account
  api/revisao/**                  existing, gains guard + scope
components/
  RevisaoForm.tsx                 existing, gains Bearer + 402 message
docker-compose.yml                services: app, postgres, postgres-test
.env.example                      DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_SENHA, LLM_*
```

Responsibilities: repositories are the only place with SQL. `quota.ts` is the only place that decrements. `guard.ts` is the only place that reads the header. `client/api.ts` is the only place the browser reads `localStorage`.

---

### Task 1: Postgres, pool and migration runner

**Files:**
- Create: `migrations/001_initial.sql`
- Create: `lib/db/pool.ts`
- Create: `lib/db/migrate.ts`
- Create: `test/db/helper.ts`
- Create: `test/db/migrations.test.ts`
- Create: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `getPool(): Pool` from `lib/db/pool.ts`, reading `process.env.DATABASE_URL` at call time.
  - `aplicarMigracoes(pool?: Pool): Promise<void>` from `lib/db/migrate.ts`.
  - `test/db/helper.ts`: `pool`, `prepararBanco(): Promise<void>`, `limparTabelas(): Promise<void>`.

- [ ] **Step 1: Install dependencies**

```powershell
npm install pg jsonwebtoken
npm install -D tsx @types/pg @types/jsonwebtoken
```

- [ ] **Step 2: Write the schema**

`migrations/001_initial.sql`:

```sql
CREATE TABLE IF NOT EXISTS planos (
  codigo text PRIMARY KEY,
  nome text NOT NULL,
  revisoes integer NOT NULL CHECK (revisoes > 0),
  preco_cents integer NOT NULL CHECK (preco_cents >= 0)
);

CREATE TABLE IF NOT EXISTS contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  saldo_revisoes integer NOT NULL DEFAULT 0 CHECK (saldo_revisoes >= 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por uuid NOT NULL REFERENCES contas(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  plano_codigo text NOT NULL REFERENCES planos(codigo),
  lote_id uuid NOT NULL REFERENCES lotes(id),
  expira_em timestamptz NOT NULL,
  criado_por uuid NOT NULL REFERENCES contas(id),
  resgatado_por uuid REFERENCES contas(id),
  resgatado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  titulo text,
  conteudo_texto text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questoes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  revisao_id uuid NOT NULL REFERENCES revisoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  enunciado text NOT NULL,
  opcoes jsonb NOT NULL DEFAULT '[]',
  resposta_correta text NOT NULL,
  dica text NOT NULL DEFAULT '',
  ordem integer NOT NULL
);

CREATE TABLE IF NOT EXISTS respostas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  questao_id bigint NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
  resposta_dada text NOT NULL,
  correto boolean NOT NULL,
  explicacao text NOT NULL,
  respondida_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimentos_saldo (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conta_id uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('registro','resgate','consumo')),
  quantidade integer NOT NULL,
  token_id uuid REFERENCES tokens(id),
  revisao_id uuid REFERENCES revisoes(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revisoes_conta ON revisoes (conta_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_resgatado_por ON tokens (resgatado_por);
CREATE INDEX IF NOT EXISTS idx_tokens_expira_em ON tokens (expira_em);
CREATE INDEX IF NOT EXISTS idx_movimentos_conta ON movimentos_saldo (conta_id, criado_em DESC);

INSERT INTO planos (codigo, nome, revisoes, preco_cents) VALUES
  ('free', 'Free', 3, 0),
  ('pro', 'Pro', 20, 500),
  ('familia', 'Família', 50, 1500)
ON CONFLICT (codigo) DO NOTHING;
```

- [ ] **Step 3: Write the failing test**

`test/db/migrations.test.ts`:

```ts
// @vitest-environment node
import { afterAll, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';

beforeAll(async () => { await prepararBanco(); });
afterAll(async () => { await pool.end(); });

test('migração cria as tabelas do modelo', async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );
  expect(rows.map(r => r.table_name)).toEqual([
    'contas', 'lotes', 'migrations', 'movimentos_saldo', 'planos', 'questoes', 'respostas', 'revisoes', 'tokens',
  ]);
});

test('migração semeia os três planos com os valores do negócio', async () => {
  const { rows } = await pool.query('SELECT codigo, revisoes, preco_cents FROM planos ORDER BY codigo');
  expect(rows).toEqual([
    { codigo: 'familia', revisoes: 50, preco_cents: 1500 },
    { codigo: 'free', revisoes: 3, preco_cents: 0 },
    { codigo: 'pro', revisoes: 20, preco_cents: 500 },
  ]);
});

test('migração é idempotente', async () => {
  await prepararBanco();
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM planos');
  expect(rows[0].c).toBe(3);
});

test('aplicarMigracoes registra as migrações aplicadas', async () => {
  const { rows } = await pool.query('SELECT name FROM migrations');
  expect(rows.map(r => r.name)).toContain('001_initial.sql');
});
```

- [ ] **Step 4: Run it to verify it fails**

```powershell
docker compose --profile test up -d postgres-test
npm run test:db
```

Expected: FAIL, `helper.ts` and `migrate.ts` do not exist yet.

- [ ] **Step 5: Write the pool**

`lib/db/pool.ts`:

```ts
import { Pool } from 'pg';

let pool: Pool | null = null;

// Lê DATABASE_URL no momento da chamada, não no import, para que os testes
// possam apontar para o banco de teste antes do primeiro uso.
export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não está definido. Copile .env.example para .env.');
    pool = new Pool({ connectionString: url });
  }
  return pool;
}
```

- [ ] **Step 6: Write the migration runner**

`lib/db/migrate.ts`:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { getPool } from './pool';

const DIR = path.join(process.cwd(), 'migrations');

export async function aplicarMigracoes(pool?: Pool): Promise<void> {
  const p = pool ?? getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const arquivos = (await fs.readdir(DIR)).filter(f => f.endsWith('.sql')).sort();
  for (const name of arquivos) {
    const jaAplicada = await p.query('SELECT 1 FROM migrations WHERE name = $1', [name]);
    if (jaAplicada.rowCount) continue;
    const sql = await fs.readFile(path.join(DIR, name), 'utf8');
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migração ${name} falhou: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}
```

- [ ] **Step 7: Write the test helper**

`test/db/helper.ts`:

```ts
import { Pool } from 'pg';
import { aplicarMigracoes } from '../../lib/db/migrate';

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
  || 'postgres://estudo:estudo@localhost:5404/estudo_test';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TABELAS = ['contas', 'planos', 'lotes', 'tokens', 'revisoes', 'questoes', 'respostas', 'movimentos_saldo'];

export async function prepararBanco(): Promise<void> {
  await aplicarMigracoes(pool);
}

export async function limparTabelas(): Promise<void> {
  await pool.query(`TRUNCATE ${TABELAS.join(', ')} RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 8: Run the tests and make sure they pass**

```powershell
npm run test:db
```

Expected: PASS, 4 tests.

- [ ] **Step 9: Add the Postgres services and scripts**

`docker-compose.yml` — the app service keeps its build, loses the hardcoded `LLM_API_KEY` and gains `DATABASE_URL` and `JWT_SECRET` from the environment file:

```yaml
services:
  explicadora:
    build: .
    container_name: explicadora
    ports:
      - "5003:3000"
    env_file: .env
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16
    container_name: explicadora-db
    environment:
      POSTGRES_USER: estudo
      POSTGRES_PASSWORD: estudo
      POSTGRES_DB: estudo
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5403:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U estudo"]
      interval: 5s
      timeout: 5s
      retries: 5

  postgres-test:
    image: postgres:16
    container_name: explicadora-db-test
    profiles: ["test"]
    environment:
      POSTGRES_USER: estudo
      POSTGRES_PASSWORD: estudo
      POSTGRES_DB: estudo_test
    ports:
      - "5404:5432"

volumes:
  pgdata:
```

`.env.example`:

```
DATABASE_URL=postgres://estudo:estudo@localhost:5403/estudo
JWT_SECRET=troque-por-um-segredo-de-32-caracteres
ADMIN_EMAIL=seu-email@exemplo.com
ADMIN_SENHA=troque-por-uma-senha-forte
LLM_BASE_URL=http://192.168.18.4:1234/v1
LLM_MODEL=gpt-6-luna
LLM_API_KEY=coloque-aqui
```

`package.json` scripts:

```json
"migrate": "tsx lib/db/migrate.ts",
"test": "vitest run test/unit components",
"test:db": "vitest run test/db",
"test:llm": "vitest run lib/llm.test.ts"
```

Add to `lib/db/migrate.ts` the CLI entry so `npm run migrate` works:

```ts
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  aplicarMigracoes()
    .then(() => semearAdmin())
    .then(() => process.exit(0))
    .catch((err) => { console.error(err.message); process.exit(1); });
}
```

- [ ] **Step 10: Commit**

```powershell
git add migrations lib/db test/db docker-compose.yml .env.example package.json
git commit -m "feat: Postgres, pool e runner de migrações"
```

---

### Task 2: Password hashing

**Files:**
- Create: `lib/auth/senha.ts`
- Create: `test/unit/senha.test.ts`

**Interfaces:**
- Consumes: `node:crypto` only.
- Produces:
  - `hashSenha(senha: string): Promise<string>`
  - `verificarSenha(senha: string, hash: string): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

`test/unit/senha.test.ts`:

```ts
import { expect, test } from 'vitest';
import { hashSenha, verificarSenha } from '../../lib/auth/senha';

test('verificarSenha aceita a senha que originou o hash', async () => {
  const hash = await hashSenha('senha-da-criança');
  expect(await verificarSenha('senha-da-criança', hash)).toBe(true);
});

test('verificarSenha rejeita senha diferente', async () => {
  const hash = await hashSenha('senha-da-criança');
  expect(await verificarSenha('outra-senha', hash)).toBe(false);
});

test('dois hashes da mesma senha são diferentes (saléado)', async () => {
  const a = await hashSenha('mesma');
  const b = await hashSenha('mesma');
  expect(a).not.toBe(b);
  expect(await verificarSenha('mesma', a)).toBe(true);
  expect(await verificarSenha('mesma', b)).toBe(true);
});

test('hash tem o formato scrypt$N$r$p$hash$sal', async () => {
  const hash = await hashSenha('x');
  expect(hash).toMatch(/^scrypt\$65536\$8\$4\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
});

test('verificarSenha não explode com hash malformado', async () => {
  expect(await verificarSenha('x', 'scrypt$1$1$1$abcd')).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:unit
```

Expected: FAIL, `lib/auth/senha.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

`lib/auth/senha.ts`:

```ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 65536;
const R = 8;
const P = 4;
const TAMANHO_HASH = 32;

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha, sal, TAMANHO_HASH, { N, R, P });
  return `scrypt$${N}$${R}$${P}$${hash.toString('base64')}$${sal.toString('base64')}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, hashBase64, salBase64] = partes;
  const esperado = await scryptAsync(senha, Buffer.from(salBase64, 'base64'), Buffer.from(hashBase64, 'base64').length, {
    N: Number(n), R: Number(r), P: Number(p),
  });
  const real = Buffer.from(hashBase64, 'base64');
  return esperado.length === real.length && timingSafeEqual(esperado, real);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```powershell
npm run test:unit
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```powershell
git add lib/auth/senha.ts test/unit/senha.test.ts
git commit -m "feat: hash de senha com scrypt"
```

---

### Task 3: Account repository with initial balance

**Files:**
- Create: `lib/repos/contas.ts`
- Create: `lib/repos/movimentos.ts`
- Create: `test/db/contas.test.ts`
- Create: `lib/db/seed-admin.ts`

**Interfaces:**
- Consumes: `getPool()` from Task 1, `hashSenha()` from Task 2.
- Produces:
  - `Conta` type in `lib/types.ts`: `{ id: string; email: string; role: 'user' | 'admin'; saldo_revisoes: number; criado_em: string; senha_hash?: string }`
  - `createConta(email: string, senhaHash: string, saldo: number, client?: PoolClient): Promise<Conta>`
  - `findContaByEmail(email: string): Promise<Conta | null>`
  - `findContaById(id: string): Promise<Conta | null>`
  - `contaPublica(c: Conta): { id: string; email: string; role: Role; saldo_revisoes: number; criado_em: string }` — the shape the API returns, without `senha_hash`.
  - `registrarMovimento(client: PoolClient, contaId: string, tipo: 'registro' | 'resgate' | 'consumo', quantidade: number, opts?: { token_id?: string; revisao_id?: string }): Promise<void>`

- [ ] **Step 1: Write the failing test**

`test/db/contas.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta, findContaByEmail, findContaById } from '../../lib/repos/contas';
import { hashSenha } from '../../lib/auth/senha';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

test('createConta grava a conta com o saldo pedido', async () => {
  const conta = await createConta('ana@example.com', await hashSenha('abc123'), 3);
  expect(conta.email).toBe('ana@example.com');
  expect(conta.role).toBe('user');
  expect(conta.saldo_revisoes).toBe(3);
});

test('email duplicado cai na constraint unique', async () => {
  const hash = await hashSenha('abc123');
  await createConta('ana@example.com', hash, 3);
  await expect(createConta('ana@example.com', hash, 3)).rejects.toThrow(/duplicate key/);
});

test('findContaByEmail devolve null para email inexistente', async () => {
  expect(await findContaByEmail('ninguem@example.com')).toBeNull();
});

test('findContaById devolve a conta criada', async () => {
  const conta = await createConta('ana@example.com', await hashSenha('abc123'), 3);
  const achada = await findContaById(conta.id);
  expect(achada?.id).toBe(conta.id);
});

test('saldo nunca fica negativo', async () => {
  const conta = await createConta('ana@example.com', await hashSenha('abc123'), 0);
  await expect(
    pool.query('UPDATE contas SET saldo_revisoes = -1 WHERE id = $1', [conta.id])
  ).rejects.toThrow(/check constraint/);
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:db
```

Expected: FAIL, `lib/repos/contas.ts` does not exist.

- [ ] **Step 3: Write the types**

Add to `lib/types.ts`:

```ts
export type Role = 'user' | 'admin';

export interface Conta {
  id: string;
  email: string;
  role: Role;
  saldo_revisoes: number;
  criado_em: string;
  senha_hash?: string; // presente apenas na leitura interna, nunca devolvido pela API
}

export interface Plano {
  codigo: string;
  nome: string;
  revisoes: number;
  preco_cents: number;
}
```

- [ ] **Step 4: Write the movements repository**

`lib/repos/movimentos.ts`:

```ts
import { PoolClient } from 'pg';
import { getPool } from '../db/pool';

export type TipoMovimento = 'registro' | 'resgate' | 'consumo';

export async function registrarMovimento(
  client: PoolClient,
  contaId: string,
  tipo: TipoMovimento,
  quantidade: number,
  opts: { token_id?: string; revisao_id?: string } = {},
): Promise<void> {
  await client.query(
    `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade, token_id, revisao_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [contaId, tipo, quantidade, opts.token_id ?? null, opts.revisao_id ?? null],
  );
}

export function extratoConta(contaId: string) {
  return getPool().query(
    `SELECT tipo, quantidade, token_id, revisao_id, criado_em
     FROM movimentos_saldo WHERE conta_id = $1 ORDER BY criado_em DESC`,
    [contaId],
  );
}
```

- [ ] **Step 5: Write the accounts repository**

`lib/repos/contas.ts`:

```ts
import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Conta } from '../types';

export async function createConta(
  email: string, senhaHash: string, saldo: number, client?: PoolClient,
): Promise<Conta> {
  const p = client ?? getPool();
  const { rows } = await p.query(
    `INSERT INTO contas (email, senha_hash, saldo_revisoes) VALUES ($1, $2, $3)
     RETURNING id, email, role, saldo_revisoes, criado_em`,
    [email.toLowerCase().trim(), senhaHash, saldo],
  );
  return rows[0] as Conta;
}

export async function findContaByEmail(email: string): Promise<Conta | null> {
  // senha_hash entra na seleção porque o login precisa comparar; as rotas nunca
  // devolvem esse campo (ver publicamente() na Task 8).
  const { rows } = await getPool().query(
    `SELECT id, email, role, saldo_revisoes, criado_em, senha_hash FROM contas WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return (rows[0] as Conta) ?? null;
}

export function contaPublica(c: Conta) {
  return { id: c.id, email: c.email, role: c.role, saldo_revisoes: c.saldo_revisoes, criado_em: c.criado_em };
}

export async function findContaById(id: string): Promise<Conta | null> {
  const { rows } = await getPool().query(
    `SELECT id, email, role, saldo_revisoes, criado_em FROM contas WHERE id = $1`,
    [id],
  );
  return (rows[0] as Conta) ?? null;
}
```

- [ ] **Step 6: Seed the admin account**

The migration cannot hash a password, so the admin account is seeded by the runner after the migrations, from `ADMIN_EMAIL` and `ADMIN_SENHA`. Add `lib/db/seed-admin.ts`:

```ts
import { getPool } from './pool';
import { hashSenha } from '../auth/senha';

export async function semearAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  if (!email || !senha) {
    console.warn('ADMIN_EMAIL/ADMIN_SENHA não definidos: conta admin não criada.');
    return;
  }
  const pool = getPool();
  const { rowCount } = await pool.query(
    `INSERT INTO contas (email, senha_hash, role, saldo_revisoes)
     VALUES ($1, $2, 'admin', 0)
     ON CONFLICT (email) DO NOTHING`,
    [email.toLowerCase().trim(), await hashSenha(senha)],
  );
  if (rowCount) console.log(`Conta admin criada: ${email}`);
}
```

Call it at the end of `aplicarMigracoes`, after the loop, and in the CLI entry. Add a test to `test/db/contas.test.ts`:

```ts
test('semearAdmin cria a conta admin e não duplica', async () => {
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_SENHA = 'senha-do-admin';
  await semearAdmin();
  await semearAdmin();
  const { rows } = await pool.query("SELECT role FROM contas WHERE email = 'admin@example.com'");
  expect(rows).toHaveLength(1);
  expect(rows[0].role).toBe('admin');
});
```

- [ ] **Step 7: Run the tests and make sure they pass**

```powershell
npm run test:db
```

Expected: PASS, 6 tests.

- [ ] **Step 8: Commit**

```powershell
git add lib/repos lib/types.ts lib/db/seed-admin.ts test/db/contas.test.ts
git commit -m "feat: repositório de contas com saldo inicial e conta admin semeada"
```

---

### Task 4: JWT and the Bearer guard

**Files:**
- Create: `lib/auth/jwt.ts`
- Create: `lib/auth/guard.ts`
- Create: `test/unit/jwt.test.ts`

**Interfaces:**
- Consumes: `jsonwebtoken`, `findContaById` from Task 3.
- Produces:
  - `assinarToken(contaId: string, role: Role): string`
  - `verificarToken(token: string): { sub: string; role: Role } | null`
  - `Auth = { contaId: string; role: Role }`
  - `autenticar(req: NextRequest): Promise<Auth | null>`

- [ ] **Step 1: Write the failing test**

`test/unit/jwt.test.ts` (node environment, because `next/server` does not work in jsdom):

```ts
// @vitest-environment node
import { expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { assinarToken, verificarToken } from '../../lib/auth/jwt';
import { autenticar } from '../../lib/auth/guard';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

test('token assinado é aceito e carrega sub e role', () => {
  const token = assinarToken('conta-1', 'admin');
  const payload = verificarToken(token);
  expect(payload).toEqual({ sub: 'conta-1', role: 'admin' });
});

test('token inválido é recusado', () => {
  expect(verificarToken('nao-e-um-jwt')).toBeNull();
});

test('token assinado com outro segredo é recusado', () => {
  const token = assinarToken('conta-1', 'user');
  process.env.JWT_SECRET = 'outro-segredo-com-pelo-menos-32-caracteres!!';
  expect(verificarToken(token)).toBeNull();
  process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';
});

test('token expirado é recusado', () => {
  const token = assinarToken('conta-1', 'user', -10);
  expect(verificarToken(token)).toBeNull();
});

test('autenticar lê o header Bearer', async () => {
  const token = assinarToken('conta-2', 'user');
  const req = new NextRequest('http://localhost/api/conta', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(await autenticar(req)).toEqual({ contaId: 'conta-2', role: 'user' });
});

test('autenticar devolve null sem header', async () => {
  const req = new NextRequest('http://localhost/api/conta');
  expect(await autenticar(req)).toBeNull();
});

test('autenticar devolve null com header malformado', async () => {
  const req = new NextRequest('http://localhost/api/conta', {
    headers: { Authorization: 'Basic abc' },
  });
  expect(await autenticar(req)).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:unit
```

Expected: FAIL, `lib/auth/jwt.ts` does not exist.

- [ ] **Step 3: Write the JWT module**

`lib/auth/jwt.ts`:

```ts
import jwt from 'jsonwebtoken';
import { Role } from '../types';

const EXPIRACAO_SEGUNDOS = 7 * 24 * 60 * 60;

function segredo(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não está definido.');
  return s;
}

export function assinarToken(contaId: string, role: Role, expiraEm?: number): string {
  return jwt.sign({ sub: contaId, role }, segredo(), { expiresIn: expiraEm ?? EXPIRACAO_SEGUNDOS });
}

export function verificarToken(token: string): { sub: string; role: Role } | null {
  try {
    const payload = jwt.verify(token, segredo()) as jwt.Payload;
    return { sub: String(payload.sub), role: payload.role as Role };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Write the guard**

`lib/auth/guard.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verificarToken } from './jwt';
import { Role } from '../types';

export interface Auth {
  contaId: string;
  role: Role;
}

export async function autenticar(req: NextRequest): Promise<Auth | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const payload = verificarToken(header.slice(7).trim());
  if (!payload) return null;
  return { contaId: payload.sub, role: payload.role };
}

export function naoAutorizado(): NextResponse {
  return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
}

export function naoAdministrador(): NextResponse {
  return NextResponse.json({ error: 'Essa área é só do administrador.' }, { status: 403 });
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

```powershell
npm run test:unit
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```powershell
git add lib/auth test/unit/jwt.test.ts
git commit -m "feat: JWT HS256 e guard de Bearer"
```

---

### Task 5: Token batches and redemption

**Files:**
- Create: `lib/repos/tokens.ts`
- Create: `test/db/tokens.test.ts`

**Interfaces:**
- Consumes: `getPool()` from Task 1, `planos` seeded in Task 1.
- Produces:
  - `TokenView = { id: string; codigo: string; plano_codigo: string; status: 'disponivel' | 'resgatado' | 'expirado'; expira_em: string; resgatado_por: string | null; resgatado_em: string | null }`
  - `gerarLote(criadoPor: string, planoCodigo: string, quantidade: number, expiraEm: Date): Promise<TokenView[]>`
  - `resgateToken(codigo: string, contaId: string): Promise<{ ok: true; plano: string; revisoes: number; novoSaldo: number } | { ok: false; motivo: 'nao_encontrado' | 'ja_resgatado' | 'expirado' }>`
  - `listarTokens(): Promise<TokenView[]>`
  - `codigoDeToken(planoCodigo: string): string`

- [ ] **Step 1: Write the failing test**

`test/db/tokens.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta } from '../../lib/repos/contas';
import { hashSenha } from '../../lib/auth/senha';
import { gerarLote, resgateToken, listarTokens, codigoDeToken } from '../../lib/repos/tokens';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const admin = () => createConta('admin@example.com', 'hash', 0);
const usuario = (email: string) => createConta(email, 'hash', 0);

test('gerarLote cria N tokens do plano pedido', async () => {
  const a = await admin();
  const lote = await gerarLote(a.id, 'pro', 5, new Date(Date.now() + 30 * 86400000));
  expect(lote).toHaveLength(5);
  expect(lote[0].status).toBe('disponivel');
  expect(lote[0].plano_codigo).toBe('pro');
});

test('código de token tem o formato PLANO-XXXX-XXXX', () => {
  expect(codigoDeToken('familia')).toMatch(/^FAMILIA-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
});

test('resgate soma as revisões do plano ao saldo', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const conta = await usuario('ana@example.com');
  const resultado = await resgateToken(token.codigo, conta.id);
  expect(resultado).toEqual({ ok: true, plano: 'pro', revisoes: 20, novoSaldo: 20 });
});

test('resgate de token já resgatado é recusado', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const conta = await usuario('ana@example.com');
  await resgateToken(token.codigo, conta.id);
  expect(await resgateToken(token.codigo, conta.id)).toEqual({ ok: false, motivo: 'ja_resgatado' });
});

test('resgate de token expirado é recusado', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() - 1000));
  const conta = await usuario('ana@example.com');
  expect(await resgateToken(token.codigo, conta.id)).toEqual({ ok: false, motivo: 'expirado' });
});

test('resgate de código inexistente é recusado', async () => {
  const conta = await usuario('ana@example.com');
  expect(await resgateToken('PRO-0000-0000', conta.id)).toEqual({ ok: false, motivo: 'nao_encontrado' });
});

test('dois resgates simultâneos do mesmo token: só um soma saldo', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const c1 = await usuario('um@example.com');
  const c2 = await usuario('dois@example.com');
  const [r1, r2] = await Promise.all([resgateToken(token.codigo, c1.id), resgateToken(token.codigo, c2.id)]);
  const ok = [r1, r2].filter(r => r.ok);
  expect(ok).toHaveLength(1);
  const { rows } = await pool.query(
    'SELECT email, saldo_revisoes FROM contas WHERE saldo_revisoes > 0 ORDER BY email'
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].saldo_revisoes).toBe(20);
});

test('listarTokens mostra o status derivado, nunca armazenado', async () => {
  const a = await admin();
  await gerarLote(a.id, 'free', 1, new Date(Date.now() + 30 * 86400000));
  await gerarLote(a.id, 'pro', 1, new Date(Date.now() - 1000));
  const tokens = await listarTokens();
  expect(tokens.map(t => t.status).sort()).toEqual(['disponivel', 'expirado']);
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:db
```

Expected: FAIL, `lib/repos/tokens.ts` does not exist.

- [ ] **Step 3: Write the tokens repository**

`lib/repos/tokens.ts`:

```ts
import { getPool } from '../db/pool';

export interface TokenView {
  id: string;
  codigo: string;
  plano_codigo: string;
  status: 'disponivel' | 'resgatado' | 'expirado';
  expira_em: string;
  resgatado_por: string | null;
  resgatado_em: string | null;
}

const COLUNAS = `
  id, codigo, plano_codigo, criado_em,
  CASE WHEN resgatado_por IS NOT NULL THEN 'resgatado'
       WHEN expira_em < now() THEN 'expirado'
       ELSE 'disponivel' END AS status,
  expira_em, resgatado_por, resgatado_em
`;

// Alfabeto sem caracteres ambíguos (0/O, 1/I) para a pessoa conseguir digitar o código.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function codigoDeToken(planoCodigo: string): string {
  const parte = () =>
    Array.from({ length: 4 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
  return `${planoCodigo.toUpperCase()}-${parte()}-${parte()}`;
}

export async function gerarLote(
  criadoPor: string, planoCodigo: string, quantidade: number, expiraEm: Date,
): Promise<TokenView[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lote = await client.query(
      'INSERT INTO lotes (criado_por, quantidade) VALUES ($1, $2) RETURNING id',
      [criadoPor, quantidade],
    );
    const codigos = Array.from({ length: quantidade }, () => codigoDeToken(planoCodigo));
    const { rows } = await client.query(
      `INSERT INTO tokens (codigo, plano_codigo, lote_id, expira_em, criado_por)
       SELECT unnest($1::text[]), $2, $3, $4, $5
       RETURNING ${COLUNAS}`,
      [codigos, planoCodigo, lote.rows[0].id, expiraEm, criadoPor],
    );
    await client.query('COMMIT');
    return rows as TokenView[];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export type ResgateResultado =
  | { ok: true; plano: string; revisoes: number; novoSaldo: number }
  | { ok: false; motivo: 'nao_encontrado' | 'ja_resgatado' | 'expirado' };

export async function resgateToken(codigo: string, contaId: string): Promise<ResgateResultado> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const token = await client.query(
      `SELECT id, plano_codigo, expira_em, resgatado_por FROM tokens WHERE codigo = $1 FOR UPDATE`,
      [codigo.trim().toUpperCase()],
    );
    const t = token.rows[0];
    if (!t) { await client.query('ROLLBACK'); return { ok: false, motivo: 'nao_encontrado' }; }
    if (t.resgatado_por) { await client.query('ROLLBACK'); return { ok: false, motivo: 'ja_resgatado' }; }
    if (new Date(t.expira_em) < new Date()) { await client.query('ROLLBACK'); return { ok: false, motivo: 'expirado' }; }

    const plano = await client.query('SELECT codigo, revisoes FROM planos WHERE codigo = $1', [t.plano_codigo]);
    const revisoes = plano.rows[0].revisoes as number;

    await client.query('UPDATE tokens SET resgatado_por = $1, resgatado_em = now() WHERE id = $2', [contaId, t.id]);
    await client.query('UPDATE contas SET saldo_revisoes = saldo_revisoes + $1 WHERE id = $2', [revisoes, contaId]);
    await client.query(
      `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade, token_id) VALUES ($1, 'resgate', $2, $3)`,
      [contaId, revisoes, t.id],
    );
    const conta = await client.query('SELECT saldo_revisoes FROM contas WHERE id = $1 FOR UPDATE', [contaId]);
    await client.query('COMMIT');
    return { ok: true, plano: t.plano_codigo, revisoes, novoSaldo: conta.rows[0].saldo_revisoes as number };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listarTokens(): Promise<TokenView[]> {
  const { rows } = await getPool().query(`SELECT ${COLUNAS} FROM tokens ORDER BY criado_em DESC`);
  return rows as TokenView[];
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```powershell
npm run test:db
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```powershell
git add lib/repos/tokens.ts test/db/tokens.test.ts migrations/001_initial.sql
git commit -m "feat: lotes de tokens e resgate com uso único"
```

---

### Task 6: Quota, the single decrement point

**Files:**
- Create: `lib/quota.ts`
- Create: `test/db/quota.test.ts`

**Interfaces:**
- Consumes: `PoolClient` from `pg`, `registrarMovimento` from Task 3.
- Produces:
  - `consumirSaldo(client: PoolClient, contaId: string): Promise<number | null>` — returns the new balance, or `null` when the balance is 0. Must be called inside a transaction opened by the caller. Writes the `consumo` movement itself.
  - `SALDO_INICIAL = 3` — the free quota granted at registration.

- [ ] **Step 1: Write the failing test**

`test/db/quota.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta } from '../../lib/repos/contas';
import { consumirSaldo } from '../../lib/quota';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

async function comTransacao<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

test('consumirSaldo decrementa e registra o movimento', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  const novo = await comTransacao((c) => consumirSaldo(c, conta.id));
  expect(novo).toBe(2);
  const { rows } = await pool.query('SELECT tipo, quantidade FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(rows).toEqual([{ tipo: 'consumo', quantidade: -1 }]);
});

test('consumirSaldo devolve null com saldo 0', async () => {
  const conta = await createConta('ana@example.com', 'hash', 0);
  expect(await comTransacao((c) => consumirSaldo(c, conta.id))).toBeNull();
});

test('dois consumos simultâneos na mesma conta não gastam a mesma revisão', async () => {
  const conta = await createConta('ana@example.com', 'hash', 1);
  const resultados = await Promise.all([
    comTransacao((c) => consumirSaldo(c, conta.id)),
    comTransacao((c) => consumirSaldo(c, conta.id)),
  ]);
  expect(resultados.filter(r => r !== null)).toHaveLength(1);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(0);
});

test('rollback devolve o saldo consumido', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await consumirSaldo(client, conta.id);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(3);
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:db
```

Expected: FAIL, `lib/quota.ts` does not exist.

- [ ] **Step 3: Write the quota module**

`lib/quota.ts`:

```ts
import { PoolClient } from 'pg';

// Único lugar do sistema que decrementa o saldo. Roda dentro da transação
// aberta pelo chamador, com FOR UPDATE, para que duas requisições simultâneas
// da mesma conta não gastem a mesma revisão.
export async function consumirSaldo(client: PoolClient, contaId: string): Promise<number | null> {
  const { rows } = await client.query(
    'SELECT saldo_revisoes FROM contas WHERE id = $1 FOR UPDATE',
    [contaId],
  );
  const atual = rows[0]?.saldo_revisoes as number | undefined;
  if (!atual || atual <= 0) return null;

  const novo = atual - 1;
  await client.query('UPDATE contas SET saldo_revisoes = $1 WHERE id = $2', [novo, contaId]);
  await client.query(
    `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade) VALUES ($1, 'consumo', -1)`,
    [contaId],
  );
  return novo;
}
```

Note: `lib/quota.ts` writes the `consumo` movement itself, so `registrarMovimento` is not needed for consumption. Keep `registrarMovimento` for `registro` and `resgate`, which happen in the repositories.

- [ ] **Step 4: Run the tests and make sure they pass**

```powershell
npm run test:db
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```powershell
git add lib/quota.ts test/db/quota.test.ts
git commit -m "feat: consumo de saldo em transação com FOR UPDATE"
```

---

### Task 7: Reviews repository scoped by account

**Files:**
- Create: `lib/repos/revisoes.ts`
- Create: `test/db/revisoes.test.ts`
- Modify: `lib/types.ts`

**Interfaces:**
- Consumes: `getPool()`, `PoolClient`, `consumirSaldo` from Task 6.
- Produces:
  - `Revisao = { id: string; conta_id: string; titulo: string | null; conteudo_texto: string; criado_em: string }`
  - `Questao = { id: number; revisao_id: string; tipo: string; enunciado: string; opcoes: string[]; resposta_correta: string; dica: string; ordem: number }`
  - `Resposta = { id: number; questao_id: number; resposta_dada: string; correto: boolean; explicacao: string; respondida_em: string }`
  - `criarRevisao(client: PoolClient | Pool, contaId: string, conteudoTexto: string, titulo: string | null): Promise<string>`
  - `getRevisao(id: string, contaId: string): Promise<Revisao | null>`
  - `getRevisaoCompleta(id: string, contaId: string): Promise<{ revisao: Revisao; questoes: Questao[]; respostas: Resposta[] } | null>`
  - `listarRevisoes(contaId: string): Promise<Revisao[]>`
  - `createQuestoes(client: PoolClient | Pool, revisaoId: string, questoes: QuestaoInput[], ordemInicial: number): Promise<void>`
  - `createResposta(questaoId: number, respostaDada: string, correto: boolean, explicacao: string): Promise<void>`
  - `getScore(revisaoId: string): Promise<{ acertos: number; total: number }>`
  - `limparRespostas(revisaoId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

`test/db/revisoes.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta } from '../../lib/repos/contas';
import {
  criarRevisao, getRevisao, getRevisaoCompleta, listarRevisoes,
  createQuestoes, createResposta, getScore,
} from '../../lib/repos/revisoes';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const conta = (email: string) => createConta(email, 'hash', 3);

test('criarRevisao liga a revisão à conta', async () => {
  const c = await conta('ana@example.com');
  const id = await criarRevisao(pool, c.id, 'Sistema solar', null);
  const revisao = await getRevisao(id, c.id);
  expect(revisao?.conta_id).toBe(c.id);
});

test('conta A não lê revisão de conta B', async () => {
  const a = await conta('ana@example.com');
  const b = await conta('bob@example.com');
  const id = await criarRevisao(pool, a.id, 'Sistema solar', null);
  expect(await getRevisao(id, b.id)).toBeNull();
  expect(await getRevisaoCompleta(id, b.id)).toBeNull();
});

test('listarRevisoes devolve só as revisões da conta, mais recentes primeiro', async () => {
  const a = await conta('ana@example.com');
  const b = await conta('bob@example.com');
  await criarRevisao(pool, b.id, 'do bob', null);
  const id1 = await criarRevisao(pool, a.id, 'primeira', null);
  const id2 = await criarRevisao(pool, a.id, 'segunda', null);
  const lista = await listarRevisoes(a.id);
  expect(lista.map(r => r.id)).toEqual([id2, id1]);
});

test('opções vêm como array, não como string JSON', async () => {
  const c = await conta('ana@example.com');
  const id = await criarRevisao(pool, c.id, 'x', null);
  await createQuestoes(pool, id, [{ tipo: 'multipla_escolha', enunciado: 'q', opcoes: ['A', 'B'], resposta_correta: 'A', dica: '' }], 1);
  const [q] = (await getRevisaoCompleta(id, c.id))!.questoes;
  expect(q.opcoes).toEqual(['A', 'B']);
});

test('getScore conta acertos da conta', async () => {
  const c = await conta('ana@example.com');
  const id = await criarRevisao(pool, c.id, 'x', null);
  await createQuestoes(pool, id, [
    { tipo: 'resposta_digitada', enunciado: 'q1', opcoes: [], resposta_correta: '42', dica: '' },
    { tipo: 'resposta_digitada', enunciado: 'q2', opcoes: [], resposta_correta: '7', dica: '' },
  ], 1);
  const questoes = (await getRevisaoCompleta(id, c.id))!.questoes;
  await createResposta(questoes[0].id, '42', true, 'ok');
  await createResposta(questoes[1].id, '8', false, 'não');
  expect(await getScore(id)).toEqual({ acertos: 1, total: 2 });
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:db
```

Expected: FAIL, `lib/repos/revisoes.ts` does not exist.

- [ ] **Step 3: Write the reviews repository**

`lib/repos/revisoes.ts`:

```ts
import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { QuestaoInput, Resposta, Revisao, Questao } from '../types';

export async function criarRevisao(
  client: PoolClient, contaId: string, conteudoTexto: string, titulo: string | null,
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO revisoes (conta_id, titulo, conteudo_texto) VALUES ($1, $2, $3) RETURNING id`,
    [contaId, titulo, conteudoTexto],
  );
  return rows[0].id as string;
}

export async function getRevisao(id: string, contaId: string): Promise<Revisao | null> {
  const { rows } = await getPool().query(
    'SELECT id, conta_id, titulo, conteudo_texto, criado_em FROM revisoes WHERE id = $1 AND conta_id = $2',
    [id, contaId],
  );
  return (rows[0] as Revisao) ?? null;
}

export async function listarRevisoes(contaId: string): Promise<Revisao[]> {
  const { rows } = await getPool().query(
    `SELECT id, conta_id, titulo, conteudo_texto, criado_em FROM revisoes
     WHERE conta_id = $1 ORDER BY criado_em DESC`,
    [contaId],
  );
  return rows as Revisao[];
}

export async function getQuestoes(revisaoId: string): Promise<Questao[]> {
  const { rows } = await getPool().query(
    `SELECT id, revisao_id, tipo, enunciado, opcoes, resposta_correta, dica, ordem
     FROM questoes WHERE revisao_id = $1 ORDER BY ordem`,
    [revisaoId],
  );
  return rows as Questao[];
}

export async function getRespostas(revisaoId: string): Promise<Resposta[]> {
  const { rows } = await getPool().query(
    `SELECT r.id, r.questao_id, r.resposta_dada, r.correto, r.explicacao, r.respondida_em
     FROM respostas r JOIN questoes q ON r.questao_id = q.id
     WHERE q.revisao_id = $1`,
    [revisaoId],
  );
  return rows as Resposta[];
}

export async function getRevisaoCompleta(id: string, contaId: string) {
  const revisao = await getRevisao(id, contaId);
  if (!revisao) return null;
  return { revisao, questoes: await getQuestoes(id), respostas: await getRespostas(id) };
}

export async function createQuestoes(
  client: PoolClient, revisaoId: string, questoes: QuestaoInput[], ordemInicial: number,
): Promise<void> {
  for (const [i, q] of questoes.entries()) {
    await client.query(
      `INSERT INTO questoes (revisao_id, tipo, enunciado, opcoes, resposta_correta, dica, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [revisaoId, q.tipo, q.enunciado, q.opcoes, q.resposta_correta, q.dica || '', ordemInicial + i],
    );
  }
}

export async function createResposta(
  questaoId: number, respostaDada: string, correto: boolean, explicacao: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO respostas (questao_id, resposta_dada, correto, explicacao) VALUES ($1, $2, $3, $4)`,
    [questaoId, respostaDada, correto, explicacao],
  );
}

export async function getScore(revisaoId: string): Promise<{ acertos: number; total: number }> {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS total FROM questoes WHERE revisao_id = $1`,
    [revisaoId],
  );
  const total = rows[0].total as number;
  const acertosRow = await getPool().query(
    `SELECT COUNT(*)::int AS acertos FROM respostas r
     JOIN questoes q ON r.questao_id = q.id
     WHERE q.revisao_id = $1 AND r.correto`,
    [revisaoId],
  );
  return { acertos: acertosRow.rows[0].acertos as number, total };
}

export async function limparRespostas(revisaoId: string): Promise<void> {
  await getPool().query(
    `DELETE FROM respostas WHERE questao_id IN (SELECT id FROM questoes WHERE revisao_id = $1)`,
    [revisaoId],
  );
}
```

- [ ] **Step 4: Update `lib/types.ts`**

The migration names the column `opcoes` instead of the spec's `opcoes_json`, so the repository returns `string[]` directly and no `JSON.parse` is needed anywhere. Replace `Sessao` with `Revisao`, `opcoes_json` with `opcoes: string[]`, `correto` with `boolean`, and `sessao_id` with `revisao_id`:

```ts
export interface Revisao {
  id: string;
  conta_id: string;
  titulo: string | null;
  conteudo_texto: string;
  criado_em: string;
}

export interface Questao {
  id: number;
  revisao_id: string;
  tipo: string;
  enunciado: string;
  opcoes: string[];
  resposta_correta: string;
  dica: string;
  ordem: number;
}

export interface Resposta {
  id: number;
  questao_id: number;
  resposta_dada: string;
  correto: boolean;
  explicacao: string;
  respondida_em: string;
}
```

Keep `QuestaoLLM`, `QuestaoInput` and `SessaoCompleta` (rename the last to `RevisaoCompleta` with `revisao: Revisao`).

- [ ] **Step 5: Run the tests and make sure they pass**

```powershell
npm run test:db
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```powershell
git add lib/repos/revisoes.ts lib/types.ts test/db/revisoes.test.ts
git commit -m "feat: repositório de revisões escopado por conta"
```

---

### Task 8: Auth routes (register and login)

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `test/db/auth.test.ts`

**Interfaces:**
- Consumes: `createConta`, `findContaByEmail` (Task 3), `hashSenha`/`verificarSenha` (Task 2), `assinarToken` (Task 4), `registrarMovimento` (Task 3), `getPool` (Task 1).
- Produces:
  - `POST /api/auth/register` body `{ email, senha }` → `201 { token, conta }`, `400` missing fields, `409` duplicate email.
  - `POST /api/auth/login` body `{ email, senha }` → `200 { token, conta }`, `401` wrong credentials.
  - `SALDO_INICIAL = 3` exported from `lib/quota.ts`.

- [ ] **Step 1: Write the failing test**

`test/db/auth.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { register } from '../../app/api/auth/register/route';
import { login } from '../../app/api/auth/login/route';
import { verificarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('registro cria conta com saldo 3 e devolve token', async () => {
  const res = await register(req({ email: 'ana@example.com', senha: 'abc123' }));
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.conta.saldo_revisoes).toBe(3);
  expect(verificarToken(data.token)).toEqual({ sub: data.conta.id, role: 'user' });
});

test('registro grava o movimento de registro', async () => {
  const res = await register(req({ email: 'ana@example.com', senha: 'abc123' }));
  const { conta } = await res.json();
  const { rows } = await pool.query('SELECT tipo, quantidade FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(rows).toEqual([{ tipo: 'registro', quantidade: 3 }]);
});

test('email duplicado retorna 409', async () => {
  await register(req({ email: 'ana@example.com', senha: 'abc123' }));
  const res = await register(req({ email: 'ana@example.com', senha: 'abc123' }));
  expect(res.status).toBe(409);
});

test('campos vazios retornam 400', async () => {
  const res = await register(req({ email: '', senha: '' }));
  expect(res.status).toBe(400);
});

test('login aceita senha correta e recusa senha errada', async () => {
  const reg = await register(req({ email: 'ana@example.com', senha: 'abc123' }));
  const { conta } = await reg.json();
  const ok = await login(req({ email: 'ana@example.com', senha: 'abc123' }));
  expect(ok.status).toBe(200);
  const ruim = await login(req({ email: 'ana@example.com', senha: 'errada' }));
  expect(ruim.status).toBe(401);
  expect((await ruim.json()).error).toBe('Email ou senha incorretos.');
});

test('login de conta admin carrega role admin no token', async () => {
  const reg = await register(req({ email: 'ana@example.com', senha: 'abc123' }));
  const { conta } = await reg.json();
  await pool.query('UPDATE contas SET role = $1 WHERE id = $2', ['admin', conta.id]);
  const res = await login(req({ email: 'ana@example.com', senha: 'abc123' }));
  const { token } = await res.json();
  expect(verificarToken(token)?.role).toBe('admin');
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:db
```

Expected: FAIL, the route files do not exist.

- [ ] **Step 3: Write the register route**

`app/api/auth/register/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';
import { createConta, findContaByEmail } from '@/lib/repos/contas';
import { registrarMovimento } from '@/lib/repos/movimentos';
import { hashSenha } from '@/lib/auth/senha';
import { assinarToken } from '@/lib/auth/jwt';
import { SALDO_INICIAL } from '@/lib/quota';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').toLowerCase().trim();
  const senha = String(body.senha ?? '');
  if (!email || !senha) {
    return NextResponse.json({ error: 'Preencha email e senha.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const conta = await createConta(email, await hashSenha(senha), SALDO_INICIAL, client);
    await registrarMovimento(client, conta.id, 'registro', SALDO_INICIAL);
    await client.query('COMMIT');
    return NextResponse.json({ token: assinarToken(conta.id, conta.role), conta: contaPublica(conta) }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Esse email já está cadastrado.' }, { status: 409 });
    }
    console.error('[POST /api/auth/register] falha:', err);
    return NextResponse.json({ error: 'Algo deu errado. Tente novamente.' }, { status: 500 });
  } finally {
    client.release();
  }
}
```

Add `export const SALDO_INICIAL = 3;` to `lib/quota.ts`.

- [ ] **Step 4: Write the login route**

`app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { findContaByEmail } from '@/lib/repos/contas';
import { verificarSenha } from '@/lib/auth/senha';
import { assinarToken } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').toLowerCase().trim();
  const senha = String(body.senha ?? '');
  if (!email || !senha) {
    return NextResponse.json({ error: 'Preencha email e senha.' }, { status: 400 });
  }

  const conta = await findContaByEmail(email);
  if (!conta || !(await verificarSenha(senha, conta.senha_hash))) {
    return NextResponse.json({ error: 'Email ou senha incorretos.' }, { status: 401 });
  }
  return NextResponse.json({ token: assinarToken(conta.id, conta.role), conta: contaPublica(conta) });
}
```

Add `contaPublica` to `lib/repos/contas.ts` in this task:

```ts
import { Conta, Role } from '../types';

export function contaPublica(c: Conta) {
  return { id: c.id, email: c.email, role: c.role, saldo_revisoes: c.saldo_revisoes, criado_em: c.criado_em };
}
```

Both routes return `contaPublica(conta)` from `lib/repos/contas.ts` (defined in Task 3), never the raw `Conta`, so `senha_hash` never reaches the response. In `register`: `return NextResponse.json({ token, conta: contaPublica(conta) }, { status: 201 })`. In `login`: `return NextResponse.json({ token, conta: contaPublica(conta) })`.

- [ ] **Step 5: Run the tests and make sure they pass**

```powershell
npm run test:db
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```powershell
git add app/api/auth lib/quota.ts test/db/auth.test.ts
git commit -m "feat: rotas de registro e login com JWT"
```

---

### Task 9: Review routes gain guard, scope and quota

**Files:**
- Modify: `app/api/revisao/route.ts`
- Modify: `app/api/revisao/[id]/route.ts`
- Modify: `app/api/revisao/[id]/responder/route.ts`
- Modify: `app/api/revisao/[id]/finalizar/route.ts`
- Modify: `app/api/revisao/[id]/reiniciar/route.ts`
- Modify: `app/api/revisao/[id]/avancar/route.ts`
- Modify: `app/api/sessoes/route.ts`
- Delete: `lib/db.ts`
- Create: `test/db/revisao-route.test.ts`

**Interfaces:**
- Consumes: `autenticar` (Task 4), `consumirSaldo` (Task 6), `lib/repos/revisoes` (Task 7), `gerarQuestoes` and friends (existing core).
- Produces: the same JSON shapes the pages already consume, plus `401`, `402` and `403` responses.

- [ ] **Step 1: Write the failing test**

`test/db/revisao-route.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as criarRevisao } from '../../app/api/revisao/route';
import { GET as lerRevisao } from '../../app/api/revisao/[id]/route';
import { GET as listar } from '../../app/api/sessoes/route';
import { createConta } from '../../lib/repos/contas';
import { criarRevisao as criarRevisaoNoBanco } from '../../lib/repos/revisoes';
import { assinarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

// Mock pelo mesmo specifier que a rota usa ('@/lib/llm'), senão o alias do
// vitest.config resolve dois módulos diferentes e o mock não pega.
vi.mock('@/lib/llm', () => ({
  gerarQuestoes: async () => [
    { tipo: 'multipla_escolha', enunciado: 'q', opcoes: ['A'], resposta_correta: 'A', dica: '' },
  ],
}));

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const reqComToken = (contaId: string, role: 'user' | 'admin' = 'user') =>
  new NextRequest('http://localhost/api/revisao', {
    headers: { Authorization: `Bearer ${assinarToken(contaId, role)}` },
  });

test('sem token responde 401', async () => {
  const res = await criarRevisao(new NextRequest('http://localhost/api/revisao', { method: 'POST' }));
  expect(res.status).toBe(401);
});

test('com saldo, cria revisão, consome 1 e grava o movimento', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  const form = new FormData();
  form.set('texto', 'Sistema solar');
  const req = new NextRequest('http://localhost/api/revisao', {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(conta.id, 'user')}` },
    body: form,
  });
  const res = await criarRevisao(req);
  expect(res.status).toBe(200);
  const { id } = await res.json();
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);
  const movimentos = await pool.query('SELECT tipo, quantidade, revisao_id FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(movimentos.rows[0].quantidade).toBe(-1);
  expect(movimentos.rows[0].revisao_id).toBe(id);
});

test('saldo esgotado responde 402 e não cria revisão', async () => {
  const conta = await createConta('ana@example.com', 'hash', 0);
  const form = new FormData();
  form.set('texto', 'Sistema solar');
  const req = new NextRequest('http://localhost/api/revisao', {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(conta.id, 'user')}` },
    body: form,
  });
  const res = await criarRevisao(req);
  expect(res.status).toBe(402);
  expect((await res.json()).error).toContain('Resgate um token');
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM revisoes WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(0);
});

test('conta A não lê revisão de conta B pela rota', async () => {
  const a = await createConta('ana@example.com', 'hash', 3);
  const b = await createConta('bob@example.com', 'hash', 3);
  const id = await criarRevisaoNoBanco(pool, a.id, 'x', null);
  const res = await lerRevisao(reqComToken(b.id), { params: { id } });
  expect(res.status).toBe(404);
});

test('listar mostra só as revisões da conta', async () => {
  const a = await createConta('ana@example.com', 'hash', 3);
  const b = await createConta('bob@example.com', 'hash', 3);
  await criarRevisaoNoBanco(pool, a.id, 'de ana', null);
  const res = await listar(reqComToken(b.id));
  expect((await res.json())).toHaveLength(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:db
```

Expected: FAIL, the routes still use `lib/db.ts` and have no guard.

- [ ] **Step 3: Rewrite `app/api/revisao/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { consumirSaldo } from '@/lib/quota';
import { criarRevisao, createQuestoes } from '@/lib/repos/revisoes';
import { gerarQuestoes, ImagemProcessada } from '@/lib/llm';
import { extrairTextoPDF } from '@/lib/pdf';
import { processarImagem } from '@/lib/imagem';
import { MAX_IMAGENS } from '@/lib/constantes';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const formData = await req.formData();
  const texto = (formData.get('texto') as string) || '';
  const files = formData.getAll('arquivos') as File[];

  let conteudoCompleto = texto;
  const imagens: ImagemProcessada[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      try { conteudoCompleto += `\n\n--- Conteúdo do PDF: ${file.name} ---\n${await extrairTextoPDF(buffer)}`; } catch {}
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
      if (imagens.length >= MAX_IMAGENS) continue;
      try {
        const { base64, mime } = await processarImagem(buffer);
        imagens.push({ base64, mime });
        fs.writeFileSync(path.join(process.cwd(), 'uploads', file.name), buffer);
      } catch {}
    }
  }

  if (!conteudoCompleto.trim() && imagens.length === 0) {
    return NextResponse.json({ error: 'Forneça texto ou arquivos.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saldo = await consumirSaldo(client, auth.contaId);
    if (saldo === null) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Você usou suas revisões. Resgate um token para continuar.' },
        { status: 402 },
      );
    }
    const questoes = await gerarQuestoes(conteudoCompleto, imagens);
    const id = await criarRevisao(client, auth.contaId, conteudoCompleto, null);
    await createQuestoes(client, id, questoes, 1);
    await client.query('UPDATE movimentos_saldo SET revisao_id = $1 WHERE conta_id = $2 AND tipo = $3 AND revisao_id IS NULL', [id, auth.contaId, 'consumo']);
    await client.query('COMMIT');
    return NextResponse.json({ id, saldo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/revisao] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Rewrite the read routes with scope**

`app/api/revisao/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisaoCompleta } from '@/lib/repos/revisoes';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  const data = await getRevisaoCompleta(params.id, auth.contaId);
  if (!data) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
  return NextResponse.json(data);
}
```

`app/api/sessoes/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { listarRevisoes } from '@/lib/repos/revisoes';

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  return NextResponse.json(await listarRevisoes(auth.contaId));
}
```

`responder` becomes:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisaoCompleta, createResposta } from '@/lib/repos/revisoes';
import { avaliarResposta } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  try {
    const body = await req.json();
    const { questaoId, resposta, imagem } = body as { questaoId: number; resposta: string; imagem?: string };

    const data = await getRevisaoCompleta(params.id, auth.contaId);
    if (!data) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });

    const questao = data.questoes.find(q => q.id === questaoId);
    if (!questao) return NextResponse.json({ error: 'Questão não encontrada.' }, { status: 404 });

    const questaoLLM: QuestaoLLM = {
      tipo: questao.tipo as QuestaoLLM['tipo'],
      enunciado: questao.enunciado,
      opcoes: questao.opcoes,
      resposta_correta: questao.resposta_correta,
      dica: questao.dica || '',
    };

    const { correto, explicacao } = await avaliarResposta(questaoLLM, resposta, imagem);
    await createResposta(questao.id, resposta, correto, explicacao);

    const indiceAtual = data.questoes.findIndex(q => q.id === questaoId);
    return NextResponse.json({
      correto, explicacao,
      questaoAtual: indiceAtual + 1,
      questoesRestantes: data.questoes.length - indiceAtual - 1,
    });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/responder] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
```

`finalizar`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisaoCompleta, getScore } from '@/lib/repos/revisoes';
import { gerarVeredito } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  try {
    const data = await getRevisaoCompleta(params.id, auth.contaId);
    if (!data) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });

    const { acertos, total } = await getScore(params.id);
    const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
    const questoesErradas: QuestaoLLM[] = data.questoes
      .filter(q => data.respostas.some(r => r.questao_id === q.id && !r.correto))
      .map(q => ({
        tipo: q.tipo as QuestaoLLM['tipo'],
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        resposta_correta: q.resposta_correta,
        dica: q.dica || '',
      }));

    const veredito = await gerarVeredito(acertos, total, questoesErradas);
    return NextResponse.json({ veredito, acertos, total, percentual });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/finalizar] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
```

`reiniciar`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisao, limparRespostas } from '@/lib/repos/revisoes';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  try {
    if (!(await getRevisao(params.id, auth.contaId))) {
      return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
    }
    await limparRespostas(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/reiniciar] falha:', err);
    return NextResponse.json({ error: 'Não consegui reiniciar. Tente novamente.' }, { status: 500 });
  }
}
```

`avancar`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getPool } from '@/lib/db/pool';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisao, getQuestoes, getRespostas, createQuestoes } from '@/lib/repos/revisoes';
import { gerarQuestoesFocadas, ModoFocado } from '@/lib/llm';
import { QuestaoLLM } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  try {
    const revisao = await getRevisao(params.id, auth.contaId);
    if (!revisao) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });

    const questoes = await getQuestoes(params.id);
    const respostas = await getRespostas(params.id);
    const questoesErradas = questoes
      .filter(q => respostas.some(r => r.questao_id === q.id && !r.correto))
      .map(q => ({
        tipo: q.tipo as QuestaoLLM['tipo'],
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        resposta_correta: q.resposta_correta,
        dica: q.dica || '',
      }));

    const modo: ModoFocado = questoesErradas.length === 0 ? 'proximo_nivel' : 'foco_nos_erros';
    const novasQuestoes = await gerarQuestoesFocadas(revisao.conteudo_texto, questoesErradas, modo);
    await createQuestoes(getPool(), params.id, novasQuestoes, questoes.length + 1);

    return NextResponse.json({ ok: true, total: questoes.length + novasQuestoes.length });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/avancar] falha:', err);
    return NextResponse.json({ error: 'Não consegui falar com o professor. Tente novamente.' }, { status: 500 });
  }
}
```

`createQuestoes` takes a `PoolClient`; `getPool()` satisfies it as a `Pool`-compatible query target only if the repository accepts both. Change the signature in `lib/repos/revisoes.ts` to `client: PoolClient | Pool` and use `client.query` the same way.

- [ ] **Step 5: Delete `lib/db.ts` and update the imports**

```powershell
git rm lib/db.ts
```

`components/RevisaoForm.tsx` and the pages keep calling the same routes; the only change is the header, done in Task 10.

- [ ] **Step 6: Run the tests and make sure they pass**

```powershell
npm run test:db
npm run test:unit
```

Expected: PASS. `components/RevisaoForm.test.tsx` must still pass unchanged.

- [ ] **Step 7: Commit**

```powershell
git add app/api lib/quota.ts
git commit -m "feat: rotas de revisão com guard, escopo por conta e consumo de saldo"
```

---

### Task 10: Client API helper and the pages that call it

**Files:**
- Create: `lib/client/api.ts`
- Create: `test/unit/api.test.ts`
- Modify: `components/RevisaoForm.tsx`
- Modify: `app/page.tsx`
- Modify: `app/estudar/[id]/page.tsx`
- Modify: `app/resultado/[id]/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks except the routes.
- Produces:
  - `guardarToken(token: string): void`
  - `lerToken(): string | null`
  - `limparToken(): void`
  - `apiFetch(input: string, init?: RequestInit): Promise<Response>` — adds `Authorization: Bearer <token>`; on 401 clears the token and redirects to `/login`.

- [ ] **Step 1: Write the failing test**

`test/unit/api.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { apiFetch, guardarToken, lerToken, limparToken } from '../../lib/client/api';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

test('guardarToken e lerToken guardam o token no localStorage', () => {
  guardarToken('abc');
  expect(lerToken()).toBe('abc');
  limparToken();
  expect(lerToken()).toBeNull();
});

test('apiFetch envia o header Bearer', async () => {
  guardarToken('abc');
  let visto: Headers | null = null;
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    visto = new Headers(options.headers);
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  await apiFetch('/api/conta');
  expect(visto?.get('authorization')).toBe('Bearer abc');
});

test('apiFetch sem token não envia header', async () => {
  let visto: Headers | null = null;
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    visto = new Headers(options.headers);
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  await apiFetch('/api/conta');
  expect(visto?.get('authorization')).toBeNull();
});

test('401 limpa o token', async () => {
  guardarToken('abc');
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response);
  await apiFetch('/api/conta');
  expect(lerToken()).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:unit
```

Expected: FAIL, `lib/client/api.ts` does not exist.

- [ ] **Step 3: Write the helper**

`lib/client/api.ts`:

```ts
const CHAVE = 'estudo_token';

export function guardarToken(token: string): void {
  localStorage.setItem(CHAVE, token);
}

export function lerToken(): string | null {
  return localStorage.getItem(CHAVE);
}

export function limparToken(): void {
  localStorage.removeItem(CHAVE);
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = lerToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    limparToken();
    // Redireciona só no navegador. Em jsdom window.location.href é read-only,
    // então o teste verifica apenas que o token foi limpo.
    if (typeof window !== 'undefined' && typeof window.location.assign === 'function') {
      window.location.assign('/login');
    }
  }
  return res;
}
```

- [ ] **Step 4: Replace `fetch` with `apiFetch` in the pages**

In `components/RevisaoForm.tsx`, `app/page.tsx`, `app/estudar/[id]/page.tsx` and `app/resultado/[id]/page.tsx`, change `fetch(` to `apiFetch(` and add `import { apiFetch } from '@/lib/client/api';`.

In `components/RevisaoForm.tsx`, handle 402 explicitly before the generic error:

```ts
if (res.status === 402) {
  setError((await res.json()).error);
  return;
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

```powershell
npm run test:unit
```

Expected: PASS, 4 tests plus the existing `RevisaoForm.test.tsx` tests.

- [ ] **Step 6: Commit**

```powershell
git add lib/client app components test/unit/api.test.ts
git commit -m "feat: helper de API com Bearer e páginas usando apiFetch"
```

---

### Task 11: Token redemption route and `/api/conta`

**Files:**
- Create: `app/api/tokens/resgate/route.ts`
- Create: `app/api/conta/route.ts`
- Create: `test/db/tokens-route.test.ts`
- Modify: `lib/repos/movimentos.ts` (join do `plano_codigo`)

**Interfaces:**
- Consumes: `autenticar`, `resgateToken`, `findContaById`, `extratoConta`.
- Produces:
  - `POST /api/tokens/resgate` body `{ codigo }` → `200 { plano, revisoes, novoSaldo }`; `401`, `404`, `409`, `410`.
- `GET /api/conta` → `200 { conta, plano, saldo, movimentos }` where `plano` is the plan of the last redemption, or `free`.

- [ ] **Step 1: Write the failing test**

`test/db/tokens-route.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as resgate } from '../../app/api/tokens/resgate/route';
import { GET as conta } from '../../app/api/conta/route';
import { createConta } from '../../lib/repos/contas';
import { gerarLote } from '../../lib/repos/tokens';
import { assinarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const post = (url: string, contaId: string, body: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` },
    body: JSON.stringify(body),
  });

const get = (url: string, contaId: string) =>
  new NextRequest(url, { headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` } });

test('resgate soma as revisões e responde 200', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  const [token] = await gerarLote(admin.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const conta = await createConta('ana@example.com', 'hash', 3);
  const res = await resgate(post('http://localhost/api/tokens/resgate', conta.id, { codigo: token.codigo }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ plano: 'pro', revisoes: 20, novoSaldo: 23 });
});

test('resgate sem token responde 401', async () => {
  const res = await resgate(new NextRequest('http://localhost/api/tokens/resgate', {
    method: 'POST', body: JSON.stringify({ codigo: 'PRO-AAAA-AAAA' }),
  }));
  expect(res.status).toBe(401);
});

test('resgate de código inexistente responde 404', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  const res = await resgate(post('http://localhost/api/tokens/resgate', conta.id, { codigo: 'PRO-AAAA-AAAA' }));
  expect(res.status).toBe(404);
});

test('resgate duplicado responde 409', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  const [token] = await gerarLote(admin.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const conta = await createConta('ana@example.com', 'hash', 3);
  await resgate(post('http://localhost/api/tokens/resgate', conta.id, { codigo: token.codigo }));
  const res = await resgate(post('http://localhost/api/tokens/resgate', conta.id, { codigo: token.codigo }));
  expect(res.status).toBe(409);
});

test('resgate expirado responde 410', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  const [token] = await gerarLote(admin.id, 'pro', 1, new Date(Date.now() - 1000));
  const conta = await createConta('ana@example.com', 'hash', 3);
  const res = await resgate(post('http://localhost/api/tokens/resgate', conta.id, { codigo: token.codigo }));
  expect(res.status).toBe(410);
});

test('GET /api/conta mostra o plano do último resgate', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  const [t1] = await gerarLote(admin.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const [t2] = await gerarLote(admin.id, 'familia', 1, new Date(Date.now() + 30 * 86400000));
  const conta = await createConta('ana@example.com', 'hash', 3);
  await resgate(post('http://localhost/api/tokens/resgate', conta.id, { codigo: t1.codigo }));
  await resgate(post('http://localhost/api/tokens/resgate', conta.id, { codigo: t2.codigo }));
  const res = await get('http://localhost/api/conta', conta.id);
  const data = await res.json();
  expect(data.plano).toBe('familia');
  expect(data.saldo).toBe(73);
  expect(data.movimentos).toHaveLength(3);
});

test('conta sem resgate mostra plano free', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  const res = await get('http://localhost/api/conta', conta.id);
  expect((await res.json()).plano).toBe('free');
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:db
```

Expected: FAIL, the routes do not exist.

- [ ] **Step 3: Write the redemption route**

`app/api/tokens/resgate/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { resgateToken } from '@/lib/repos/tokens';

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const body = await req.json().catch(() => ({}));
  const codigo = String(body.codigo ?? '').trim().toUpperCase();
  if (!codigo) return NextResponse.json({ error: 'Cole o código do token.' }, { status: 400 });

  const resultado = await resgateToken(codigo, auth.contaId);
  if (resultado.ok) return NextResponse.json(resultado);

  const status = { nao_encontrado: 404, ja_resgatado: 409, expirado: 410 }[resultado.motivo];
  const mensagens = {
    nao_encontrado: 'Esse código não existe.',
    ja_resgatado: 'Esse token já foi usado.',
    expirado: 'Esse token expirou. Peça um novo.',
  };
  return NextResponse.json({ error: mensagens[resultado.motivo] }, { status });
}
```

- [ ] **Step 4: Write the account route**

`app/api/conta/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { contaPublica, findContaById } from '@/lib/repos/contas';
import { extratoConta } from '@/lib/repos/movimentos';

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const conta = await findContaById(auth.contaId);
  if (!conta) return naoAutorizado();

  const movimentos = (await extratoConta(conta.id)).rows;
  const ultimoResgate = movimentos.find(m => m.tipo === 'resgate');

  return NextResponse.json({
    conta: contaPublica(conta),
    plano: ultimoResgate?.plano_codigo ?? 'free',
    saldo: conta.saldo_revisoes,
    movimentos,
  });
}
```

`plano_codigo` is not on `movimentos_saldo`, so `extratoConta` joins the token. Change the query in `lib/repos/movimentos.ts`:

```ts
export function extratoConta(contaId: string) {
  return getPool().query(
    `SELECT m.tipo, m.quantidade, m.token_id, m.revisao_id, t.plano_codigo, m.criado_em
     FROM movimentos_saldo m
     LEFT JOIN tokens t ON t.id = m.token_id
     WHERE m.conta_id = $1 ORDER BY m.criado_em DESC`,
    [contaId],
  );
}
```

The rows come back newest first, so `movimentos.find(m => m.tipo === 'resgate')` is the last redemption, which is what `/conta` shows as the current plan.

- [ ] **Step 5: Run the tests and make sure they pass**

```powershell
npm run test:db
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```powershell
git add app/api/tokens app/api/conta lib/repos/movimentos.ts test/db/tokens-route.test.ts
git commit -m "feat: resgate de token e rota de conta"
```

---

### Task 12: Admin area to generate and list tokens

**Files:**
- Create: `app/api/admin/tokens/route.ts`
- Create: `test/db/admin.test.ts`

**Interfaces:**
- Consumes: `autenticar` (Task 4), `gerarLote` and `listarTokens` (Task 5), `findContaById` (Task 3).
- Produces:
  - `POST /api/admin/tokens` body `{ plano_codigo, quantidade, expira_em_dias? }` → `201 { lote, tokens }`; `401`, `403`, `400`.
  - `GET /api/admin/tokens` → `200 TokenView[]` with `criado_em` and `email` of who redeemed.

- [ ] **Step 1: Write the failing test**

`test/db/admin.test.ts`:

```ts
// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as gerar, GET as listar } from '../../app/api/admin/tokens/route';
import { createConta } from '../../lib/repos/contas';
import { assinarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const req = (contaId: string, role: 'user' | 'admin', body?: unknown) =>
  new NextRequest('http://localhost/api/admin/tokens', {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${assinarToken(contaId, role)}` },
    body: body ? JSON.stringify(body) : undefined,
  });

const semHeader = (method: 'GET' | 'POST') =>
  new NextRequest('http://localhost/api/admin/tokens', { method });

test('conta comum não acessa a área admin', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  expect((await listar(conta.id, 'user')).status).toBe(403);
  expect((await gerar(conta.id, 'user', { plano_codigo: 'pro', quantidade: 1 })).status).toBe(403);
});

test('sem token responde 401', async () => {
  expect((await semHeader('GET')).status).toBe(401);
  expect((await semHeader('POST')).status).toBe(401);
});

test('admin gera lote de tokens', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  const res = await gerar(admin.id, 'admin', { plano_codigo: 'pro', quantidade: 5 });
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.tokens).toHaveLength(5);
  expect(data.tokens[0].codigo).toMatch(/^PRO-/);
});

test('quantidade inválida responde 400', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  expect((await gerar(admin.id, 'admin', { plano_codigo: 'pro', quantidade: 0 })).status).toBe(400);
  expect((await gerar(admin.id, 'admin', { plano_codigo: 'inexistente', quantidade: 1 })).status).toBe(400);
});

test('listar mostra status derivado e quem resgatou', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  await gerar(admin.id, 'admin', { plano_codigo: 'pro', quantidade: 2 });
  const res = await listar(admin.id, 'admin');
  const tokens = await res.json();
  expect(tokens).toHaveLength(2);
  expect(tokens[0].status).toBe('disponivel');
  expect(tokens[0].resgatado_por).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test:db
```

Expected: FAIL, the route does not exist.

- [ ] **Step 3: Write the admin route**

`app/api/admin/tokens/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado, naoAdministrador } from '@/lib/auth/guard';
import { gerarLote, listarTokens } from '@/lib/repos/tokens';
import { getPool } from '@/lib/db/pool';

const EXPIRACAO_PADRAO_DIAS = 30;

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (auth.role !== 'admin') return naoAdministrador();

  const { rows } = await getPool().query(
    `SELECT t.id, t.codigo, t.plano_codigo,
            CASE WHEN t.resgatado_por IS NOT NULL THEN 'resgatado'
                 WHEN t.expira_em < now() THEN 'expirado'
                 ELSE 'disponivel' END AS status,
            t.expira_em, t.resgatado_por, t.resgatado_em, t.criado_em,
            c.email AS resgatado_por_email
     FROM tokens t LEFT JOIN contas c ON c.id = t.resgatado_por
     ORDER BY t.criado_em DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (auth.role !== 'admin') return naoAdministrador();

  const body = await req.json().catch(() => ({}));
  const planoCodigo = String(body.plano_codigo ?? '').trim().toLowerCase();
  const quantidade = Number(body.quantidade);
  const dias = Number(body.expira_em_dias) || EXPIRACAO_PADRAO_DIAS;

  const planos = ['free', 'pro', 'familia'];
  if (!planos.includes(planoCodigo)) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) {
    return NextResponse.json({ error: 'Quantidade entre 1 e 100.' }, { status: 400 });
  }

  const expiraEm = new Date(Date.now() + dias * 86400000);
  const tokens = await gerarLote(auth.contaId, planoCodigo, quantidade, expiraEm);
  return NextResponse.json({ lote: tokens.length, tokens }, { status: 201 });
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```powershell
npm run test:db
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```powershell
git add app/api/admin test/db/admin.test.ts
git commit -m "feat: área admin de geração e listagem de tokens"
```

---

### Task 13: Pages for login, cadastro, conta and admin

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/cadastro/page.tsx`
- Create: `app/conta/page.tsx`
- Create: `app/admin/page.tsx`
- Modify: `app/page.tsx` (redirect to `/login` when there is no token)

**Interfaces:**
- Consumes: `apiFetch`, `guardarToken`, `lerToken` (Task 10), the routes from Tasks 8, 11 and 12.

These pages are verified manually. The plan does not invent UI tests for them.

- [ ] **Step 1: Login page**

`app/login/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, guardarToken } from '@/lib/client/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (!res.ok) { setErro((await res.json()).error); return; }
    const { token } = await res.json();
    guardarToken(token);
    router.push('/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={entrar} className="w-full max-w-md bg-white p-6 rounded-xl shadow space-y-4">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <label htmlFor="email" className="block text-lg">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg p-3 text-lg" />
        <label htmlFor="senha" className="block text-lg">Senha</label>
        <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
          className="w-full border rounded-lg p-3 text-lg" />
        <button className="w-full bg-blue-600 text-white rounded-lg p-3 text-lg">Entrar</button>
        {erro && <p className="text-red-600">{erro}</p>}
        <p><a href="/cadastro">Criar conta free (3 revisões)</a></p>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Registration page**

`app/cadastro/page.tsx` — same form as login, posting to `/api/auth/register`, with the copy "Conta free: 3 revisões. Quando acabarem, você precisa de um token." and the same `guardarToken` + `router.push('/')` on success.

- [ ] **Step 3: Account page**

`app/conta/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch, guardarToken } from '@/lib/client/api';

interface Movimento { tipo: string; quantidade: number; plano_codigo: string | null; criado_em: string }

export default function Conta() {
  const [dados, setDados] = useState<{ plano: string; saldo: number; movimentos: Movimento[]; conta: { role: string } } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => { apiFetch('/api/conta').then(r => r.json()).then(setDados); }, []);

  async function resgatar(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch('/api/tokens/resgate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codigo }),
    });
    if (!res.ok) { setErro((await res.json()).error); return; }
    const r = await res.json();
    setErro(''); setCodigo('');
    setDados(d => d ? { ...d, plano: r.plano, saldo: r.novoSaldo, movimentos: d.movimentos } : d);
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Minha conta</h1>
      <p className="text-lg">Plano: <strong>{dados?.plano}</strong> · Saldo: <strong>{dados?.saldo}</strong> revisões</p>
      <form onSubmit={resgatar} className="space-y-3">
        <label htmlFor="codigo" className="block text-lg">Cole o código do token</label>
        <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)}
          className="w-full border rounded-lg p-3 text-lg font-mono" />
        <button className="bg-green-600 text-white rounded-lg p-3 text-lg">Resgatar token</button>
        {erro && <p className="text-red-600">{erro}</p>}
      </form>
      <table className="w-full text-left">
        <thead><tr><th>Tipo</th><th>Quantidade</th><th>Quando</th></tr></thead>
        <tbody>
          {dados?.movimentos.map((m, i) => (
            <tr key={i}>
              <td>{m.tipo}</td><td>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
              <td>{new Date(m.criado_em).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 4: Admin page**

`app/admin/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';

interface TokenRow { codigo: string; plano_codigo: string; status: string; expira_em: string; resgatado_por_email: string | null }

export default function Admin() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [plano, setPlano] = useState('pro');
  const [quantidade, setQuantidade] = useState(10);
  const [erro, setErro] = useState('');

  async function carregar() {
    const res = await apiFetch('/api/admin/tokens');
    if (res.status === 403) { setErro('Essa área é só do administrador.'); return; }
    setErro(''); setTokens(await res.json());
  }

  useEffect(() => { carregar(); }, []);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch('/api/admin/tokens', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plano_codigo: plano, quantidade }),
    });
    if (!res.ok) { setErro((await res.json()).error); return; }
    setErro(''); carregar();
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Área do administrador</h1>
      <form onSubmit={gerar} className="flex flex-wrap gap-3 items-center">
        <select value={plano} onChange={(e) => setPlano(e.target.value)} className="border rounded-lg p-2">
          <option value="free">Free (3)</option>
          <option value="pro">Pro (20 · R$ 5)</option>
          <option value="familia">Família (50 · R$ 15)</option>
        </select>
        <input type="number" min="1" max="100" value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))} className="border rounded-lg p-2" />
        <button className="bg-blue-600 text-white rounded-lg p-2">Gerar lote</button>
      </form>
      {erro && <p className="text-red-600">{erro}</p>}
      <table className="w-full text-left">
        <thead><tr><th>Código</th><th>Plano</th><th>Status</th><th>Expira</th><th>Resgatado por</th></tr></thead>
        <tbody>
          {tokens.map(t => (
            <tr key={t.codigo}>
              <td className="font-mono">{t.codigo}</td><td>{t.plano_codigo}</td><td>{t.status}</td>
              <td>{new Date(t.expira_em).toLocaleDateString('pt-BR')}</td>
              <td>{t.resgatado_por_email ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

The home page shows the review title as `titulo ?? conteudo_texto.slice(0, 60)`, which is what `app/page.tsx` already does.

- [ ] **Step 5: Guard the home page**

In `app/page.tsx`, at the top of the component:

```tsx
useEffect(() => { if (!lerToken()) router.replace('/login'); }, [router]);
```

- [ ] **Step 6: Manual verification**

```powershell
docker compose up -d postgres
npm run migrate
npm run dev
```

Check, in this order: register a free account, see balance 3, create 3 reviews, the 4th returns the 402 message, generate a `pro` token in `/admin`, redeem it in `/conta`, balance becomes 23, the same code returns "já foi usado", a non-admin account cannot open `/admin`.

- [ ] **Step 7: Commit**

```powershell
git add app
git commit -m "feat: páginas de login, cadastro, conta e admin"
```

---

### Task 14: Migrations at startup and environment cleanup

**Files:**
- Create: `instrumentation.ts`
- Modify: `Dockerfile`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `aplicarMigracoes` (Task 1).

- [ ] **Step 1: Write the startup hook**

`instrumentation.ts`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { aplicarMigracoes } = await import('./lib/db/migrate');
    await aplicarMigracoes();
  }
}
```

- [ ] **Step 2: Remove the SQLite leftovers**

Delete the `data/` volume mount from `docker-compose.yml` (done in Task 1) and remove the SQLite block from `.gitignore`:

```
# SQLite databases
*.db
*.db-shm
*.db-wal
*.sqlite
*.sqlite3
```

Keep `.env` in `.gitignore`.

- [ ] **Step 3: Dockerfile**

The `data` directory is no longer needed:

```dockerfile
RUN mkdir -p /app/uploads
```

- [ ] **Step 4: Verify**

```powershell
docker compose up -d --build
docker compose logs explicadora | Select-String "migrations"
```

Expected: the app starts and the `migrations` table contains `001_initial.sql`.

- [ ] **Step 5: Commit**

```powershell
git add instrumentation.ts Dockerfile .gitignore
git commit -m "feat: migrações na subida do container"
```

---

## Out of scope for this plan

- Payment gateway. The token is the proof of purchase.
- Rate limiting and account blocking. Creating accounts to farm the free 3 reviews is not addressed; it is a business decision, not a technical one.
- Refresh token and session revocation.
- Transactional email when generating tokens.
- Migrating `data/estudo.db`.
