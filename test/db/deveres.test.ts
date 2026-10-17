// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta } from '../../lib/repos/contas';
import {
  criarDever, criarPassos, getDever, getDeverPorChave, getPassos, listarDeveresComResumo,
} from '../../lib/repos/deveres';
import { comTransacao } from '../../lib/repos/transacao';
import { consumirSaldo } from '../../lib/quota';
import { vincularMovimentoADever, vincularMovimentoARevisao } from '../../lib/repos/movimentos';
import { criarRevisao } from '../../lib/repos/revisoes';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const cena = { fundo: '#FDF6EC', primitivos: [{ kind: 'texto', x: 0.5, y: 0.5, valor: 'oi', tamanho: 0.1 }] };

test('criarDever + criarPassos grava e relê na ordem', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 3);
  const id = await criarDever(pool, conta.id, {
    titulo: 'Soma com barras', disciplina: 'Matemática',
    conteudo_texto: 'conteúdo', resumo_para_pais: 'resumo',
  });
  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'Primeiro', narracao: 'a', cena, audio_path: null, duracao_ms: 2000 },
    { ordem: 2, titulo: 'Depois', narracao: 'b', cena, audio_path: 'uploads/deveres/x/2.wav', duracao_ms: 3000 },
  ]);

  const passos = await getPassos(id);
  expect(passos.map(p => p.titulo)).toEqual(['Primeiro', 'Depois']);
  expect(passos[1].audio_path).toBe('uploads/deveres/x/2.wav');
  expect(passos[0].cena).toEqual(cena);
});

test('getDever respeita a posse', async () => {
  const a = await createConta('Ana', 'S', 'ana2@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'bob2@example.com', 'hash', 3);
  const id = await criarDever(pool, a.id, {
    titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null,
  });
  expect(await getDever(id, a.id)).not.toBeNull();
  expect(await getDever(id, b.id)).toBeNull();
});

test('getDeverPorChave acha o dever da tentativa', async () => {
  const conta = await createConta('Ana', 'S', 'ana3@example.com', 'hash', 3);
  const id = await criarDever(pool, conta.id, {
    titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null,
    chaveIdempotencia: 'chave-abc',
  });
  const achado = await getDeverPorChave(pool, conta.id, 'chave-abc');
  expect(achado?.id).toBe(id);
  expect(await getDeverPorChave(pool, conta.id, 'outra')).toBeNull();
});

test('listarDeveresComResumo traz a contagem de passos', async () => {
  const conta = await createConta('Ana', 'S', 'ana4@example.com', 'hash', 3);
  const id = await criarDever(pool, conta.id, {
    titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null,
  });
  await criarPassos(pool, id, [
    { ordem: 1, titulo: 'a', narracao: 'a', cena, audio_path: null, duracao_ms: null },
    { ordem: 2, titulo: 'b', narracao: 'b', cena, audio_path: null, duracao_ms: null },
  ]);
  const lista = await listarDeveresComResumo(conta.id);
  expect(lista).toHaveLength(1);
  expect(lista[0].total_passos).toBe(2);
  expect(lista[0].disciplina).toBe('Matemática');
});

test('dois deveres sem chave coexistem', async () => {
  const conta = await createConta('Ana', 'S', 'ana5@example.com', 'hash', 3);
  await criarDever(pool, conta.id, { titulo: null, disciplina: null, conteudo_texto: 'a', resumo_para_pais: null });
  await criarDever(pool, conta.id, { titulo: null, disciplina: null, conteudo_texto: 'b', resumo_para_pais: null });
  expect(await listarDeveresComResumo(conta.id)).toHaveLength(2);
});

// A unicidade da chave de idempotência é POR CONTA (índice único parcial em
// (conta_id, chave_idempotencia) WHERE chave_idempotencia IS NOT NULL), não global:
// a mesma chave em contas diferentes coexistem e cada conta vê só o seu dever.
test('a mesma chave em contas diferentes coexistem (unicidade por conta)', async () => {
  const a = await createConta('Ana', 'S', 'ana6@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'bob6@example.com', 'hash', 3);
  const idA = await criarDever(pool, a.id, {
    titulo: 'dever A', disciplina: null, conteudo_texto: 'a', resumo_para_pais: null,
    chaveIdempotencia: 'chave-compartilhada',
  });
  const idB = await criarDever(pool, b.id, {
    titulo: 'dever B', disciplina: null, conteudo_texto: 'b', resumo_para_pais: null,
    chaveIdempotencia: 'chave-compartilhada',
  });
  expect(idA).not.toBe(idB);
  expect((await getDeverPorChave(pool, a.id, 'chave-compartilhada'))?.id).toBe(idA);
  expect((await getDeverPorChave(pool, b.id, 'chave-compartilhada'))?.id).toBe(idB);
});

test('vincularMovimentoADever liga o consumo ao dever', async () => {
  const conta = await createConta('Ana', 'S', 'ana6@example.com', 'hash', 3);
  await comTransacao(async (client) => {
    const saldo = await consumirSaldo(client, conta.id);
    expect(saldo).toBe(2);
    const id = await criarDever(client, conta.id, {
      titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null,
    });
    await vincularMovimentoADever(client, conta.id, id);
  });

  const { rows } = await pool.query(
    'SELECT tipo, quantidade, dever_id, revisao_id FROM movimentos_saldo WHERE conta_id = $1',
    [conta.id],
  );
  expect(rows[0].quantidade).toBe(-1);
  expect(rows[0].revisao_id).toBeNull();
  expect(rows[0].dever_id).toBeTruthy();
});

// Finding P92 da re-verificação broad: `vincularMovimentoARevisao` ganhou
// `AND dever_id IS NULL` (movimentos.ts:30), espelhando vincularMovimentoADever.
// Sem essa cláusula, a próxima revisão da conta roubaria o consumo já vinculado a
// um dever, corrompendo o extrato. O teste é a prova simétrica do anterior: o
// movimento fica com dever_id preenchido e revisao_id nulo, e o vínculo de revisão
// subsequente não pode tocá-lo.
test('vincularMovimentoARevisao não captura um movimento já vinculado a um dever', async () => {
  const conta = await createConta('Ana', 'S', 'ana7@example.com', 'hash', 3);
  // A FK movimentos_saldo.revisao_id -> revisoes(id) (migrations/001_initial.sql:72)
  // exige uma revisão real: um uuid aleatório daria erro de FK no UPDATE.
  const revisaoId = await criarRevisao(pool, conta.id, 'Sistema solar', null);

  await comTransacao(async (client) => {
    const saldo = await consumirSaldo(client, conta.id);
    expect(saldo).toBe(2);
    const deverId = await criarDever(client, conta.id, {
      titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null,
    });
    await vincularMovimentoADever(client, conta.id, deverId);
  });

  // A revisão chega depois, fora da transação do dever: é exatamente o caso em que
  // o UPDATE sem `dever_id IS NULL` capturaria o consumo alheio.
  await comTransacao(async (client) => {
    await vincularMovimentoARevisao(client, conta.id, revisaoId);
  });

  const { rows } = await pool.query(
    'SELECT tipo, quantidade, dever_id, revisao_id FROM movimentos_saldo WHERE conta_id = $1',
    [conta.id],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].tipo).toBe('consumo');
  expect(rows[0].quantidade).toBe(-1);
  // O vínculo de revisão não tocou o movimento do dever.
  expect(rows[0].revisao_id).toBeNull();
  expect(rows[0].dever_id).toBeTruthy();
});
