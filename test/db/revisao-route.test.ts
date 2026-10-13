// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as criarRevisao } from '../../app/api/revisao/route';
import { GET as lerRevisao } from '../../app/api/revisao/[id]/route';
import { GET as listar } from '../../app/api/revisoes/route';
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
