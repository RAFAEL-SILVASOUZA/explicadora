// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as criarDever } from '../../app/api/dever/route';
import { createConta } from '../../lib/repos/contas';
import { assinarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

// Mock pelos mesmos specifiers que a rota importa, senão o alias do vitest
// resolve dois módulos e o mock não pega (mesmo motivo de revisao-route.test.ts).
const { gerarStoryboardSeguro, sintetizarPassos } = vi.hoisted(() => ({
  gerarStoryboardSeguro: vi.fn(),
  sintetizarPassos: vi.fn(),
}));
vi.mock('@/lib/deveres/llm', () => ({ gerarStoryboardSeguro }));
vi.mock('@/lib/deveres/piper', () => ({ sintetizarPassos }));

const cena = { fundo: '#FDF6EC', primitivos: [] };
const storyboardFixo = {
  titulo: 'Soma com barras',
  disciplina: 'Matemática',
  resumo_para_pais: 'A Lia explica o método.',
  passos: [
    { titulo: 'Primeiro', narracao: 'a', cena },
    { titulo: 'Depois', narracao: 'b', cena },
  ],
};

beforeAll(async () => { await prepararBanco(); });
beforeEach(() => {
  gerarStoryboardSeguro.mockReset();
  gerarStoryboardSeguro.mockImplementation(async () => ({ storyboard: storyboardFixo, vazamentosCorrigidos: 0 }));
  sintetizarPassos.mockReset();
  sintetizarPassos.mockImplementation(async (deverId: string, passos: { ordem: number }[]) =>
    passos.map((p) => ({ ordem: p.ordem, caminho: `uploads/deveres/${deverId}/${p.ordem}.wav`, duracao_ms: 2000 })));
});
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const post = (contaId: string, chave?: string) => {
  const form = new FormData();
  form.set('texto', 'dever de matemática');
  const headers: Record<string, string> = { Authorization: `Bearer ${assinarToken(contaId, 'user')}` };
  if (chave) headers['X-Idempotency-Key'] = chave;
  return new NextRequest('http://localhost/api/dever', { method: 'POST', headers, body: form });
};

test('sem token responde 401', async () => {
  const res = await criarDever(new NextRequest('http://localhost/api/dever', { method: 'POST' }));
  expect(res.status).toBe(401);
});

test('sem conteúdo responde 400', async () => {
  const conta = await createConta('Ana', 'S', 'd1@example.com', 'hash', 3);
  const form = new FormData();
  const res = await criarDever(new NextRequest('http://localhost/api/dever', {
    method: 'POST', headers: { Authorization: `Bearer ${assinarToken(conta.id, 'user')}` }, body: form,
  }));
  expect(res.status).toBe(400);
});

test('com saldo cria o dever, os passos e debita 1', async () => {
  const conta = await createConta('Ana', 'S', 'd2@example.com', 'hash', 3);
  const res = await criarDever(post(conta.id, 'chave-1'));
  expect(res.status).toBe(200);
  const { id } = await res.json();

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);

  const passos = await pool.query('SELECT ordem, titulo, audio_path, duracao_ms FROM dever_passos WHERE dever_id = $1 ORDER BY ordem', [id]);
  expect(passos.rows).toHaveLength(2);
  expect(passos.rows[0].audio_path).toContain('1.wav');
  expect(passos.rows[0].duracao_ms).toBe(2000);

  const mov = await pool.query('SELECT dever_id FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(mov.rows[0].dever_id).toBe(id);
});

test('saldo esgotado responde 402 e não cria dever', async () => {
  const conta = await createConta('Ana', 'S', 'd3@example.com', 'hash', 0);
  const res = await criarDever(post(conta.id, 'chave-2'));
  expect(res.status).toBe(402);
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM deveres WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(0);
});

test('LLM falha: nada debitado, nada persistido', async () => {
  const conta = await createConta('Ana', 'S', 'd4@example.com', 'hash', 3);
  gerarStoryboardSeguro.mockRejectedValueOnce(new Error('LLM offline'));
  const res = await criarDever(post(conta.id, 'chave-3'));
  expect(res.status).toBe(500);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(3);
  const deveres = await pool.query('SELECT count(*)::int AS c FROM deveres WHERE conta_id = $1', [conta.id]);
  expect(deveres.rows[0].c).toBe(0);
});

test('reenvio com a mesma chave devolve o mesmo dever sem debitar de novo', async () => {
  const conta = await createConta('Ana', 'S', 'd5@example.com', 'hash', 3);
  const id1 = (await (await criarDever(post(conta.id, 'chave-4'))).json()).id;
  const res2 = await criarDever(post(conta.id, 'chave-4'));
  expect(res2.status).toBe(200);
  const corpo = await res2.json();
  expect(corpo.id).toBe(id1);
  expect(corpo.duplicate).toBe(true);

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);
  expect(gerarStoryboardSeguro).toHaveBeenCalledTimes(1);
});

test('corrida com a mesma chave debita exatamente uma vez', async () => {
  const conta = await createConta('Ana', 'S', 'd6@example.com', 'hash', 3);
  const [r1, r2] = await Promise.all([criarDever(post(conta.id, 'chave-5')), criarDever(post(conta.id, 'chave-5'))]);
  expect(r1.status).toBe(200);
  expect(r2.status).toBe(200);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);
  const mov = await pool.query('SELECT count(*)::int AS c FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(mov.rows[0].c).toBe(1);
});

test('sem áudio (Piper ausente) cria o dever com audio_path nulo', async () => {
  const conta = await createConta('Ana', 'S', 'd7@example.com', 'hash', 3);
  sintetizarPassos.mockImplementation(async (_id: string, passos: { ordem: number }[]) =>
    passos.map((p) => ({ ordem: p.ordem, caminho: '', duracao_ms: null })));
  const res = await criarDever(post(conta.id, 'chave-6'));
  expect(res.status).toBe(200);
  const { id } = await res.json();
  const passos = await pool.query('SELECT audio_path, duracao_ms FROM dever_passos WHERE dever_id = $1', [id]);
  expect(passos.rows[0].audio_path).toBeNull();
  expect(passos.rows[0].duracao_ms).toBeNull();
});
