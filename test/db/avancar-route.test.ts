// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as avancar } from '../../app/api/revisao/[id]/avancar/route';
import { createConta } from '../../lib/repos/contas';
import { criarRevisao, createQuestoes } from '../../lib/repos/revisoes';
import { assinarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

// Mock pelo mesmo specifier que a rota usa ('@/lib/llm'). Controlável para o teste
// de falha da LLM; o beforeEach devolve a implementação padrão.
const { gerarQuestoesFocadas } = vi.hoisted(() => ({ gerarQuestoesFocadas: vi.fn() }));
vi.mock('@/lib/llm', () => ({ gerarQuestoesFocadas }));

const novaQuestao = [
  { tipo: 'multipla_escolha', enunciado: 'nova', opcoes: ['A'], resposta_correta: 'A', dica: '' },
];

beforeAll(async () => { await prepararBanco(); });
beforeEach(() => {
  gerarQuestoesFocadas.mockReset();
  gerarQuestoesFocadas.mockImplementation(async () => novaQuestao);
});
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const reqComToken = (contaId: string, url: string) =>
  new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` },
  });

// Revisão com uma questão e nenhuma resposta: modo 'proximo_nivel', sem LLM de foco.
const prepararRevisao = async (contaId: string) => {
  const id = await criarRevisao(pool, contaId, 'x', null);
  await createQuestoes(pool, id, [{ tipo: 'resposta_digitada', enunciado: 'q1', opcoes: [], resposta_correta: '42', dica: '' }], 1);
  return id;
};

test('avancar debita 1 no commit e vincula o movimento à revisão', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 3);
  const id = await prepararRevisao(conta.id);

  const res = await avancar(reqComToken(conta.id, `/api/revisao/${id}/avancar`), { params: { id } });
  expect(res.status).toBe(200);

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);
  const movimentos = await pool.query('SELECT tipo, quantidade, revisao_id FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(movimentos.rows).toHaveLength(1);
  expect(movimentos.rows[0].quantidade).toBe(-1);
  expect(movimentos.rows[0].revisao_id).toBe(id);

  const questoes = await pool.query('SELECT count(*)::int AS c FROM questoes WHERE revisao_id = $1', [id]);
  expect(questoes.rows[0].c).toBe(2); // a original + a nova
});

test('avancar com saldo 0 responde 402 e não cria questões', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 0);
  const id = await prepararRevisao(conta.id);

  const res = await avancar(reqComToken(conta.id, `/api/revisao/${id}/avancar`), { params: { id } });
  expect(res.status).toBe(402);
  const questoes = await pool.query('SELECT count(*)::int AS c FROM questoes WHERE revisao_id = $1', [id]);
  expect(questoes.rows[0].c).toBe(1);
  const movimentos = await pool.query('SELECT count(*)::int AS c FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(movimentos.rows[0].c).toBe(0);
});

// Guard do rollback: antes do fix a rota não debitava, então este teste passava de
// qualquer jeito. Depois do fix, ele prova que o débito do commit é devolvido quando
// a LLM falha — o comportamento que o fix não pode quebrar.
test('avancar com LLM falha: rollback, sem débito e sem questões', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 3);
  const id = await prepararRevisao(conta.id);
  gerarQuestoesFocadas.mockRejectedValueOnce(new Error('LLM offline'));

  const res = await avancar(reqComToken(conta.id, `/api/revisao/${id}/avancar`), { params: { id } });
  expect(res.status).toBe(500);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(3);
  const questoes = await pool.query('SELECT count(*)::int AS c FROM questoes WHERE revisao_id = $1', [id]);
  expect(questoes.rows[0].c).toBe(1);
  const movimentos = await pool.query('SELECT count(*)::int AS c FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(movimentos.rows[0].c).toBe(0);
});
