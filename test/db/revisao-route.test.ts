// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
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
// `gerarQuestoes` é um vi.fn() controlável: o teste de falha da LLM precisa fazer
// o mock rejeitar, e o beforeEach devolve a implementação padrão.
const { gerarQuestoes } = vi.hoisted(() => ({ gerarQuestoes: vi.fn() }));
vi.mock('@/lib/llm', () => ({ gerarQuestoes }));

const questoesFixas = [
  { tipo: 'multipla_escolha', enunciado: 'q', opcoes: ['A'], resposta_correta: 'A', dica: '' },
];

beforeAll(async () => { await prepararBanco(); });
beforeEach(() => {
  gerarQuestoes.mockReset();
  gerarQuestoes.mockImplementation(async () => questoesFixas);
});
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

const postComChave = (contaId: string, chave: string) => {
  const form = new FormData();
  form.set('texto', 'Sistema solar');
  return new NextRequest('http://localhost/api/revisao', {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}`, 'X-Idempotency-Key': chave },
    body: form,
  });
};

test('POST com X-Idempotency-Key grava a chave na revisão', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  const res = await criarRevisao(postComChave(conta.id, 'chave-abc'));
  expect(res.status).toBe(200);
  const { id } = await res.json();
  const { rows } = await pool.query('SELECT chave_idempotencia FROM revisoes WHERE id = $1', [id]);
  expect(rows[0].chave_idempotencia).toBe('chave-abc');
});

test('reenvio com a mesma chave devolve a mesma revisão sem debitar de novo', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  const res1 = await criarRevisao(postComChave(conta.id, 'chave-abc'));
  const id1 = (await res1.json()).id;

  const res2 = await criarRevisao(postComChave(conta.id, 'chave-abc'));
  expect(res2.status).toBe(200);
  expect((await res2.json()).id).toBe(id1);

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);
  const movimentos = await pool.query('SELECT count(*)::int AS c FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(movimentos.rows[0].c).toBe(1);
  const revisoes = await pool.query('SELECT count(*)::int AS c FROM revisoes WHERE conta_id = $1', [conta.id]);
  expect(revisoes.rows[0].c).toBe(1);
});

test('corrida com a mesma chave debita exatamente uma vez', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  const [res1, res2] = await Promise.all([
    criarRevisao(postComChave(conta.id, 'chave-abc')),
    criarRevisao(postComChave(conta.id, 'chave-abc')),
  ]);
  expect(res1.status).toBe(200);
  expect(res2.status).toBe(200);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);
  const movimentos = await pool.query('SELECT count(*)::int AS c FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(movimentos.rows[0].c).toBe(1);
});

test('GET /api/revisoes inclui a chave de idempotência na resposta', async () => {
  const a = await createConta('ana@example.com', 'hash', 3);
  await criarRevisaoNoBanco(pool, a.id, 'de ana', null, 'chave-abc');
  const res = await listar(reqComToken(a.id));
  const linha = (await res.json())[0];
  expect(linha.chave_idempotencia).toBe('chave-abc');
});

test('LLM falha com chave pendente: nada persistido, nada debitado', async () => {
  const conta = await createConta('ana@example.com', 'hash', 3);
  gerarQuestoes.mockRejectedValueOnce(new Error('LLM offline'));
  const res = await criarRevisao(postComChave(conta.id, 'chave-abc'));
  expect(res.status).toBe(500);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(3);
  const revisoes = await pool.query('SELECT count(*)::int AS c FROM revisoes WHERE conta_id = $1', [conta.id]);
  expect(revisoes.rows[0].c).toBe(0);
});
