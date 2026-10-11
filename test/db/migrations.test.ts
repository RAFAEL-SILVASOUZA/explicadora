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
