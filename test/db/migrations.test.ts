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
    'contas', 'dever_passos', 'deveres', 'lotes', 'migrations', 'movimentos_saldo',
    'planos', 'questoes', 'respostas', 'revisoes', 'tokens',
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

test('migração 005 cria a chave única parcial de deveres', async () => {
  await pool.query(
    `INSERT INTO contas (nome, sobrenome, email, senha_hash) VALUES ('A','B','chave@teste.com','h')`
  );
  const { rows: contaRows } = await pool.query(`SELECT id FROM contas WHERE email = 'chave@teste.com'`);
  const contaId = contaRows[0].id;

  await pool.query(
    `INSERT INTO deveres (conta_id, conteudo_texto, chave_idempotencia) VALUES ($1, 'x', 'k1')`,
    [contaId],
  );
  await expect(
    pool.query(`INSERT INTO deveres (conta_id, conteudo_texto, chave_idempotencia) VALUES ($1, 'x', 'k1')`, [contaId]),
  ).rejects.toThrow();

  // chave nula não colide: dois deveres sem chave convivem
  await pool.query(`INSERT INTO deveres (conta_id, conteudo_texto) VALUES ($1, 'y')`, [contaId]);
  await pool.query(`INSERT INTO deveres (conta_id, conteudo_texto) VALUES ($1, 'z')`, [contaId]);
  const { rows } = await pool.query(`SELECT count(*)::int AS c FROM deveres WHERE conta_id = $1`, [contaId]);
  expect(rows[0].c).toBe(3);

  // a unicidade é por conta, não global: outra conta pode usar a MESMA chave
  await pool.query(
    `INSERT INTO contas (nome, sobrenome, email, senha_hash) VALUES ('C','D','outra@teste.com','h')`
  );
  const { rows: outraRows } = await pool.query(`SELECT id FROM contas WHERE email = 'outra@teste.com'`);
  const outraContaId = outraRows[0].id;
  await pool.query(
    `INSERT INTO deveres (conta_id, conteudo_texto, chave_idempotencia) VALUES ($1, 'x', 'k1')`,
    [outraContaId],
  );
  const { rows: outraContagem } = await pool.query(
    `SELECT count(*)::int AS c FROM deveres WHERE conta_id = $1`,
    [outraContaId],
  );
  expect(outraContagem[0].c).toBe(1);

  // o índice é parcial: a definição no catálogo carrega o predicado WHERE
  const { rows: idxRows } = await pool.query(
    `SELECT indexdef FROM pg_indexes
     WHERE tablename = 'deveres' AND indexname = 'idx_deveres_chave'`
  );
  expect(idxRows).toHaveLength(1);
  expect(idxRows[0].indexdef).toContain('UNIQUE');
  expect(idxRows[0].indexdef).toContain('(conta_id, chave_idempotencia)');
  expect(idxRows[0].indexdef).toContain('WHERE (chave_idempotencia IS NOT NULL)');
});
