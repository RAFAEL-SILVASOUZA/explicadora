// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta } from '../../lib/repos/contas';
import {
  criarRevisao, getRevisao, getRevisaoCompleta, listarRevisoes,
  createQuestoes, createResposta, getScore,
} from '../../lib/repos/revisoes';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const conta = (email: string) => createConta(email, 'hash', 3);

test('criarRevisao liga a revisão à conta', async () => {
  const c = await conta('ana@example.com');
  const id = await criarRevisao(pool, c.id, 'Sistema solar', null);
  const revisao = await getRevisao(id, c.id);
  expect(revisao?.conta_id).toBe(c.id);
});

test('conta A não lê revisão de conta B', async () => {
  const a = await conta('ana@example.com');
  const b = await conta('bob@example.com');
  const id = await criarRevisao(pool, a.id, 'Sistema solar', null);
  expect(await getRevisao(id, b.id)).toBeNull();
  expect(await getRevisaoCompleta(id, b.id)).toBeNull();
});

test('listarRevisoes devolve só as revisões da conta, mais recentes primeiro', async () => {
  const a = await conta('ana@example.com');
  const b = await conta('bob@example.com');
  await criarRevisao(pool, b.id, 'do bob', null);
  const id1 = await criarRevisao(pool, a.id, 'primeira', null);
  const id2 = await criarRevisao(pool, a.id, 'segunda', null);
  const lista = await listarRevisoes(a.id);
  expect(lista.map(r => r.id)).toEqual([id2, id1]);
});

test('opções vêm como array, não como string JSON', async () => {
  const c = await conta('ana@example.com');
  const id = await criarRevisao(pool, c.id, 'x', null);
  await createQuestoes(pool, id, [{ tipo: 'multipla_escolha', enunciado: 'q', opcoes: ['A', 'B'], resposta_correta: 'A', dica: '' }], 1);
  const [q] = (await getRevisaoCompleta(id, c.id))!.questoes;
  expect(q.opcoes).toEqual(['A', 'B']);
});

test('id de questão vem como number, não como string (parser de int8)', async () => {
  const c = await conta('ana@example.com');
  const id = await criarRevisao(pool, c.id, 'x', null);
  await createQuestoes(pool, id, [{ tipo: 'resposta_digitada', enunciado: 'q1', opcoes: [], resposta_correta: '42', dica: '' }], 1);
  const [q] = (await getRevisaoCompleta(id, c.id))!.questoes;
  // A coluna é bigint GENERATED ALWAYS AS IDENTITY: sem parser de int8, o pg devolve string.
  expect(typeof q.id).toBe('number');
  // createResposta recebe o valor que o repositório devolveu, sem conversão.
  await createResposta(q.id, '42', true, 'ok');
  const [r] = (await getRevisaoCompleta(id, c.id))!.respostas;
  expect(typeof r.id).toBe('number');
  expect(typeof r.questao_id).toBe('number');
  expect(r.questao_id).toBe(q.id);
});

test('getScore conta acertos da conta', async () => {
  const c = await conta('ana@example.com');
  const id = await criarRevisao(pool, c.id, 'x', null);
  await createQuestoes(pool, id, [
    { tipo: 'resposta_digitada', enunciado: 'q1', opcoes: [], resposta_correta: '42', dica: '' },
    { tipo: 'resposta_digitada', enunciado: 'q2', opcoes: [], resposta_correta: '7', dica: '' },
  ], 1);
  const questoes = (await getRevisaoCompleta(id, c.id))!.questoes;
  await createResposta(questoes[0].id, '42', true, 'ok');
  await createResposta(questoes[1].id, '8', false, 'não');
  expect(await getScore(id)).toEqual({ acertos: 1, total: 2 });
});
