// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as resgate } from '../../app/api/tokens/resgate/route';
import { GET as conta } from '../../app/api/conta/route';
import { createConta } from '../../lib/repos/contas';
import { registrarMovimento } from '../../lib/repos/movimentos';
import { comTransacao } from '../../lib/repos/transacao';
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
  // `aluna` em vez de `conta`: `conta` é a rota importada, que este teste chama.
  const aluna = await createConta('ana@example.com', 'hash', 3);
  // O movimento de registro é escrito pela rota de registro, não por createConta.
  // O fixture grava essa linha para que os 3 movimentos sejam registro + 2 resgates.
  await comTransacao(async (client) => { await registrarMovimento(client, aluna.id, 'registro', 3); });
  await resgate(post('http://localhost/api/tokens/resgate', aluna.id, { codigo: t1.codigo }));
  await resgate(post('http://localhost/api/tokens/resgate', aluna.id, { codigo: t2.codigo }));
  const res = await conta(get('http://localhost/api/conta', aluna.id));
  const data = await res.json();
  expect(data.plano).toBe('familia');
  expect(data.saldo).toBe(73);
  expect(data.movimentos).toHaveLength(3);
});

test('conta sem resgate mostra plano free', async () => {
  const aluna = await createConta('ana@example.com', 'hash', 3);
  const res = await conta(get('http://localhost/api/conta', aluna.id));
  expect((await res.json()).plano).toBe('free');
});
