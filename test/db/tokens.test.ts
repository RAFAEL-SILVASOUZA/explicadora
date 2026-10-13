// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas } from './helper';
import { createConta } from '../../lib/repos/contas';
import { hashSenha } from '../../lib/auth/senha';
import { consumirSaldo } from '../../lib/quota';
import { registrarMovimento } from '../../lib/repos/movimentos';
import { comTransacao } from '../../lib/repos/transacao';
import {
  gerarLote, resgateToken, listarTokens, listarTokensComEmail, codigoDeToken, planoExiste,
  revogarToken, excluirToken,
} from '../../lib/repos/tokens';

beforeAll(async () => { await prepararBanco(); });
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const admin = () => createConta('admin@example.com', 'hash', 0);
const usuario = (email: string) => createConta(email, 'hash', 0);

test('gerarLote cria N tokens do plano pedido', async () => {
  const a = await admin();
  const lote = await gerarLote(a.id, 'pro', 5, new Date(Date.now() + 30 * 86400000));
  expect(lote).toHaveLength(5);
  expect(lote[0].status).toBe('disponivel');
  expect(lote[0].plano_codigo).toBe('pro');
});

test('código de token tem o formato PLANO-XXXX-XXXX', () => {
  expect(codigoDeToken('familia')).toMatch(/^FAMILIA-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
});

// Ruling GG: `planos` é tabela de referência, não enum no código. Este teste é o que
// discrimina a consulta à tabela: um plano inserido aqui é aceito, e um plano que não
// está na tabela não é. Sem `planoExiste`, o plano novo seria rejeitado por um enum.
test('planoExiste aceita um plano inserido na tabela', async () => {
  await pool.query(
    `INSERT INTO planos (codigo, nome, revisoes, preco_cents) VALUES ('elite', 'Elite', 100, 3000)`
  );
  expect(await planoExiste('elite')).toBe(true);
  expect(await planoExiste('inexistente')).toBe(false);
});

test('resgate soma as revisões do plano ao saldo', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const conta = await usuario('ana@example.com');
  const resultado = await resgateToken(token.codigo, conta.id);
  expect(resultado).toEqual({ ok: true, plano: 'pro', revisoes: 20, novoSaldo: 20 });
});

test('resgate de token já resgatado é recusado', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const conta = await usuario('ana@example.com');
  await resgateToken(token.codigo, conta.id);
  expect(await resgateToken(token.codigo, conta.id)).toEqual({ ok: false, motivo: 'ja_resgatado' });
});

test('resgate de token expirado é recusado', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() - 1000));
  const conta = await usuario('ana@example.com');
  expect(await resgateToken(token.codigo, conta.id)).toEqual({ ok: false, motivo: 'expirado' });
});

test('resgate de código inexistente é recusado', async () => {
  const conta = await usuario('ana@example.com');
  expect(await resgateToken('PRO-0000-0000', conta.id)).toEqual({ ok: false, motivo: 'nao_encontrado' });
});

test('dois resgates simultâneos do mesmo token: só um soma saldo', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const c1 = await usuario('um@example.com');
  const c2 = await usuario('dois@example.com');
  const [r1, r2] = await Promise.all([resgateToken(token.codigo, c1.id), resgateToken(token.codigo, c2.id)]);
  const ok = [r1, r2].filter(r => r.ok);
  expect(ok).toHaveLength(1);
  const { rows } = await pool.query(
    'SELECT email, saldo_revisoes FROM contas WHERE saldo_revisoes > 0 ORDER BY email'
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].saldo_revisoes).toBe(20);
});

test('listarTokens mostra o status derivado, nunca armazenado', async () => {
  const a = await admin();
  await gerarLote(a.id, 'free', 1, new Date(Date.now() + 30 * 86400000));
  await gerarLote(a.id, 'pro', 1, new Date(Date.now() - 1000));
  const tokens = await listarTokens();
  expect(tokens.map(t => t.status).sort()).toEqual(['disponivel', 'expirado']);
});

// O consumo não guarda qual token o financiou (consumirSaldo insere sem token_id), então a
// quantidade usada vem da ordem de entrada do extrato. Este teste é o que discrimina FIFO de
// "tudo depois do resgate": dos 4 consumos, o terceiro ainda sai do crédito do cadastro que
// estava disponível, e só o quarto vem do resgate. FIFO dá 1; "depois do resgate" daria 2.
// O movimento 'registro' é o que dá ao FIFO de onde atribuir os consumos — o mesmo que a rota
// de cadastro escreve.
test('usada conta só o crédito daquele resgate, não o consumo anterior a ele', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const aluna = await createConta('ana@example.com', 'hash', 3);
  await comTransacao((c) => registrarMovimento(c, aluna.id, 'registro', 3));
  for (let i = 0; i < 2; i++) await comTransacao((c) => consumirSaldo(c, aluna.id));
  await resgateToken(token.codigo, aluna.id);
  for (let i = 0; i < 2; i++) await comTransacao((c) => consumirSaldo(c, aluna.id));
  const [linha] = await listarTokensComEmail();
  expect(linha.usados).toBe(1);
});

test('revogarToken estorna o que não foi usado quando o uso é de até 2', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const aluna = await createConta('ana@example.com', 'hash', 0);
  await resgateToken(token.codigo, aluna.id);
  for (let i = 0; i < 2; i++) await comTransacao((c) => consumirSaldo(c, aluna.id));
  // O estorno devolve o que sobra, e o saldo fica em 0: as 2 usadas já viraram revisão.
  expect(await revogarToken(token.id)).toEqual({ ok: true, usados: 2, estornado: 18, novoSaldo: 0 });
  const { rows } = await pool.query(
    'SELECT tipo, quantidade FROM movimentos_saldo WHERE conta_id = $1 ORDER BY id', [aluna.id],
  );
  expect(rows).toEqual([
    { tipo: 'resgate', quantidade: 20 },
    { tipo: 'consumo', quantidade: -1 },
    { tipo: 'consumo', quantidade: -1 },
    { tipo: 'revogacao', quantidade: -18 },
  ]);
});

test('revogarToken recusa quando o aluno usou mais de 2 créditos do token', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const aluna = await createConta('ana@example.com', 'hash', 0);
  await resgateToken(token.codigo, aluna.id);
  for (let i = 0; i < 3; i++) await comTransacao((c) => consumirSaldo(c, aluna.id));
  expect(await revogarToken(token.id)).toEqual({ ok: false, motivo: 'limite_de_uso', usados: 3 });
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [aluna.id]);
  expect(rows[0].saldo_revisoes).toBe(17);
});

test('revogarToken recusa código que nunca foi resgatado e código já revogado', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  expect(await revogarToken(token.id)).toEqual({ ok: false, motivo: 'nao_resgatado' });
  const aluna = await createConta('ana@example.com', 'hash', 0);
  await resgateToken(token.codigo, aluna.id);
  await revogarToken(token.id);
  expect(await revogarToken(token.id)).toEqual({ ok: false, motivo: 'ja_revogado' });
});

test('listarTokensComEmail mostra o status revogado e a quantidade usada', async () => {
  const a = await admin();
  const [token] = await gerarLote(a.id, 'pro', 1, new Date(Date.now() + 30 * 86400000));
  const aluna = await createConta('ana@example.com', 'hash', 0);
  await resgateToken(token.codigo, aluna.id);
  await comTransacao((c) => consumirSaldo(c, aluna.id));
  await revogarToken(token.id);
  const [linha] = await listarTokensComEmail();
  expect(linha.status).toBe('revogado');
  expect(linha.usados).toBe(1);
});

test('excluirToken remove só código que nunca foi usado', async () => {
  const a = await admin();
  const [livre, usado] = await gerarLote(a.id, 'pro', 2, new Date(Date.now() + 30 * 86400000));
  const aluna = await createConta('ana@example.com', 'hash', 0);
  await resgateToken(usado.codigo, aluna.id);
  expect(await excluirToken(usado.id)).toEqual({ ok: false, motivo: 'ja_usado' });
  expect(await excluirToken(livre.id)).toEqual({ ok: true });
  expect(await excluirToken(livre.id)).toEqual({ ok: false, motivo: 'nao_encontrado' });
});
