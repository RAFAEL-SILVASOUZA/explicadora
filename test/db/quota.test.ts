// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta } from '../../lib/repos/contas';
import { consumirSaldo } from '../../lib/quota';
import { comTransacao } from '../../lib/repos/transacao';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

test('consumirSaldo decrementa e registra o movimento', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 3);
  const novo = await comTransacao((c) => consumirSaldo(c, conta.id));
  expect(novo).toBe(2);
  const { rows } = await pool.query('SELECT tipo, quantidade FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(rows).toEqual([{ tipo: 'consumo', quantidade: -1 }]);
});

// Ruling XX: o teste anterior só afirmava o null, então um gasto duplo que deixasse o
// saldo em 0 com duas linhas de movimento passava. Aqui a ausência da linha é o que
// discrimina: consumirSaldo não escreve nada quando não decrementa.
test('consumirSaldo devolve null com saldo 0 e não insere movimento', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 0);
  expect(await comTransacao((c) => consumirSaldo(c, conta.id))).toBeNull();
  const { rows } = await pool.query('SELECT id FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(rows).toHaveLength(0);
});

test('dois consumos simultâneos na mesma conta não gastam a mesma revisão', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 1);
  const resultados = await Promise.all([
    comTransacao((c) => consumirSaldo(c, conta.id)),
    comTransacao((c) => consumirSaldo(c, conta.id)),
  ]);
  expect(resultados.filter(r => r !== null)).toHaveLength(1);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(0);
});

test('rollback devolve o saldo consumido', async () => {
  const conta = await createConta('Ana', 'Souza', 'ana@example.com', 'hash', 3);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await consumirSaldo(client, conta.id);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(3);
});
