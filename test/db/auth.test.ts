// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
// Um route.ts do App Router só pode exportar métodos HTTP e as config flags,
// então o handler é importado pelo nome POST e apelidado no teste. Um export
// extra (`export const register = POST`) quebra `next build`: o check de tipos
// gerado em .next/types rejeita export que não é método HTTP.
import { POST as register } from '../../app/api/auth/register/route';
import { POST as login } from '../../app/api/auth/login/route';
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
