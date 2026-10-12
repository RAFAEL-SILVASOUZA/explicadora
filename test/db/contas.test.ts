// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta, findContaByEmail, findContaById } from '../../lib/repos/contas';
import { hashSenha } from '../../lib/auth/senha';
import { semearAdmin } from '../../lib/db/seed-admin';

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

test('semearAdmin cria a conta admin e não duplica', async () => {
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_SENHA = 'senha-do-admin';
  await semearAdmin();
  await semearAdmin();
  const { rows } = await pool.query("SELECT role FROM contas WHERE email = 'admin@example.com'");
  expect(rows).toHaveLength(1);
  expect(rows[0].role).toBe('admin');
});
