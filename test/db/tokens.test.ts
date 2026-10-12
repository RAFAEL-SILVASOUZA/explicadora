// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { pool, prepararBanco, limparTabelas, semearPlanos } from './helper';
import { createConta } from '../../lib/repos/contas';
import { hashSenha } from '../../lib/auth/senha';
import { gerarLote, resgateToken, listarTokens, codigoDeToken } from '../../lib/repos/tokens';

beforeAll(async () => { await prepararBanco(); });
// limparTabelas() truncate planos junto com as demais, então o fixture de planos é
// re-semeado por este arquivo depois de cada teste: ele não depende do que outro arquivo semeou.
afterEach(async () => { await limparTabelas(); await semearPlanos(); });
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
