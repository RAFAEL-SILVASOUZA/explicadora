// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as gerar, GET as listar } from '../../app/api/admin/tokens/route';
import { createConta } from '../../lib/repos/contas';
import { resgateToken } from '../../lib/repos/tokens';
import { assinarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

// Os handlers recebem uma NextRequest, não a conta: o bloco do plano passava `conta.id`
// direto, o que não compila nem roda. O helper monta o request com o Bearer da conta.
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
  expect((await listar(req(conta.id, 'user'))).status).toBe(403);
  expect((await gerar(req(conta.id, 'user', { plano_codigo: 'pro', quantidade: 1 }))).status).toBe(403);
});

test('sem token responde 401', async () => {
  expect((await listar(semHeader('GET'))).status).toBe(401);
  expect((await gerar(semHeader('POST'))).status).toBe(401);
});

test('admin gera lote de tokens', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  const res = await gerar(req(admin.id, 'admin', { plano_codigo: 'pro', quantidade: 5 }));
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(data.tokens).toHaveLength(5);
  expect(data.tokens[0].codigo).toMatch(/^PRO-/);
});

test('quantidade inválida responde 400', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  expect((await gerar(req(admin.id, 'admin', { plano_codigo: 'pro', quantidade: 0 }))).status).toBe(400);
  expect((await gerar(req(admin.id, 'admin', { plano_codigo: 'inexistente', quantidade: 1 }))).status).toBe(400);
});

test('listar mostra status derivado e quem resgatou', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  await gerar(req(admin.id, 'admin', { plano_codigo: 'pro', quantidade: 2 }));
  const res = await listar(req(admin.id, 'admin'));
  const tokens = await res.json();
  expect(tokens).toHaveLength(2);
  expect(tokens[0].status).toBe('disponivel');
  expect(tokens[0].resgatado_por).toBeNull();
});

// O teste acima declara "quem resgatou" mas só afirma que ainda não resgatou ninguém.
// Este cobre o join que a interface do GET promete (`resgatado_por_email`).
test('listar mostra o email de quem resgatou', async () => {
  const admin = await createConta('admin@example.com', 'hash', 0);
  const aluna = await createConta('ana@example.com', 'hash', 3);
  const resGerado = await gerar(req(admin.id, 'admin', { plano_codigo: 'pro', quantidade: 1 }));
  const { tokens } = await resGerado.json();
  await resgateToken(tokens[0].codigo, aluna.id);
  const res = await listar(req(admin.id, 'admin'));
  const [linha] = await res.json();
  expect(linha.status).toBe('resgatado');
  expect(linha.resgatado_por).toBe(aluna.id);
  expect(linha.resgatado_por_email).toBe('ana@example.com');
});
