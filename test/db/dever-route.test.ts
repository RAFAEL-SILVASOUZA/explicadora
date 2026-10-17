// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as criarDever } from '../../app/api/dever/route';
import { GET as listarDeveres } from '../../app/api/deveres/route';
import { GET as lerDever } from '../../app/api/dever/[id]/route';
import { GET as lerAudio } from '../../app/api/dever/[id]/audio/[ordem]/route';
import { criarDever as criarDeverRepo, criarPassos } from '../../lib/repos/deveres';
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
  gerarStoryboardSeguro.mockImplementation(async () => ({ storyboard: storyboardFixo, vazamentoNaoCorrigido: false }));
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

const reqComToken = (contaId: string) =>
  new NextRequest('http://localhost/api/deveres', {
    headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` },
  });

test('GET /api/deveres mostra só os deveres da conta', async () => {
  const a = await createConta('Ana', 'S', 'd8@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'd9@example.com', 'hash', 3);
  await criarDeverRepo(pool, a.id, { titulo: 'T', disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const res = await listarDeveres(reqComToken(b.id));
  expect(await res.json()).toHaveLength(0);
});

test('GET /api/dever/[id] devolve dever e passos ordenados', async () => {
  const a = await createConta('Ana', 'S', 'd10@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null });
  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'Primeiro', narracao: 'a', cena, audio_path: null, duracao_ms: 1000 },
    { ordem: 2, titulo: 'Depois', narracao: 'b', cena, audio_path: null, duracao_ms: 2000 },
  ]);
  const res = await lerDever(reqComToken(a.id), { params: { id } });
  const corpo = await res.json();
  expect(res.status).toBe(200);
  expect(corpo.dever.disciplina).toBe('Matemática');
  expect(corpo.passos.map((p: { titulo: string }) => p.titulo)).toEqual(['Primeiro', 'Depois']);
});

test('conta B não lê dever de A', async () => {
  const a = await createConta('Ana', 'S', 'd11@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'd12@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const res = await lerDever(reqComToken(b.id), { params: { id } });
  expect(res.status).toBe(404);
});

test('GET de áudio exige posse e devolve o WAV', async () => {
  const a = await createConta('Ana', 'S', 'd13@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'd14@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const relativo = `uploads/deveres/${id}/1.wav`;
  await fs.mkdir(path.join(process.cwd(), 'uploads', 'deveres', id), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), relativo), Buffer.from('RIFF-dados'));

  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'a', narracao: 'a', cena, audio_path: relativo, duracao_ms: 1000 },
  ]);

  const resA = await lerAudio(reqComToken(a.id), { params: { id, ordem: '1' } });
  expect(resA.status).toBe(200);
  expect(resA.headers.get('content-type')).toBe('audio/wav');
  // A resposta depende da posse validada no token: sem Vary, um cache
  // compartilhado pode servir o áudio de A para B na mesma URL.
  expect(resA.headers.get('vary')).toBe('Authorization');

  const resB = await lerAudio(reqComToken(b.id), { params: { id, ordem: '1' } });
  expect(resB.status).toBe(404);

  await fs.rm(path.join(process.cwd(), 'uploads', 'deveres', id), { recursive: true, force: true });
});

test('áudio de passo inexistente responde 404', async () => {
  const a = await createConta('Ana', 'S', 'd15@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const res = await lerAudio(reqComToken(a.id), { params: { id, ordem: '9' } });
  expect(res.status).toBe(404);
});

// Discrimina o guard Number.isInteger/ordem < 1: sem ele, Number('abc') = NaN e
// o 404 viria de !passo?.audio_path, com outra mensagem.
test('ordem não numérica ou < 1 cai no guard de ordem (404 Passo inválido)', async () => {
  const a = await createConta('Ana', 'S', 'd16@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'a', narracao: 'a', cena, audio_path: null, duracao_ms: 1000 },
  ]);

  for (const ordem of ['abc', '0', '-1']) {
    const res = await lerAudio(reqComToken(a.id), { params: { id, ordem } });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Passo inválido.');
  }
});

test('GET /api/deveres devolve o dever com total_passos', async () => {
  const a = await createConta('Ana', 'S', 'd17@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null });
  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'Primeiro', narracao: 'a', cena, audio_path: null, duracao_ms: 1000 },
    { ordem: 2, titulo: 'Depois', narracao: 'b', cena, audio_path: null, duracao_ms: 2000 },
  ]);

  const res = await listarDeveres(reqComToken(a.id));
  expect(res.status).toBe(200);
  const corpo = await res.json();
  expect(corpo).toHaveLength(1);
  expect(corpo[0].id).toBe(id);
  expect(corpo[0].total_passos).toBe(2);
});

// Insere os passos em ordem decrescente de criação: só o ORDER BY ordem de
// getPassos devolve 'Primeiro' antes de 'Depois'.
test('passos vêm em ordem crescente de ordem mesmo inseridos ao contrário', async () => {
  const a = await createConta('Ana', 'S', 'd18@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null });
  await criarPassos(pool, id, [
    { ordem: 2, titulo: 'Depois', narracao: 'b', cena, audio_path: null, duracao_ms: 2000 },
    { ordem: 1, titulo: 'Primeiro', narracao: 'a', cena, audio_path: null, duracao_ms: 1000 },
  ]);

  const res = await lerDever(reqComToken(a.id), { params: { id } });
  expect(res.status).toBe(200);
  const corpo = await res.json();
  expect(corpo.passos.map((p: { titulo: string }) => p.titulo)).toEqual(['Primeiro', 'Depois']);
  expect(corpo.passos.map((p: { ordem: number }) => p.ordem)).toEqual([1, 2]);
});

