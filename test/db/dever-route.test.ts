// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as criarDever } from '../../app/api/dever/route';
import { GET as listarDeveres } from '../../app/api/deveres/route';
import { GET as lerDever } from '../../app/api/dever/[id]/route';
import { criarDever as criarDeverRepo, criarSlides } from '../../lib/repos/deveres';
import { createConta } from '../../lib/repos/contas';
import { assinarToken } from '../../lib/auth/jwt';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

// Mock pelos mesmos specifiers que a rota importa, senão o alias do vitest
// resolve dois módulos e o mock não pega (mesmo motivo de revisao-route.test.ts).
const { gerarPlanoSeguro } = vi.hoisted(() => ({ gerarPlanoSeguro: vi.fn() }));
vi.mock('@/lib/deveres/llm', () => ({ gerarPlanoSeguro }));

// Bytes da biblioteca saíram do disco para o object storage. Mock de memória com
// a mesma interface de lib/uploads/storage; entra pelo alias '@' que resolve o
// mesmo arquivo importado por biblioteca.ts.
const { storageStore } = vi.hoisted(() => ({ storageStore: new Map<string, Buffer>() }));
vi.mock('@/lib/uploads/storage', () => ({
  bucket: () => 'uploads',
  storageUpload: vi.fn(async (chave: string, bytes: Buffer) => { storageStore.set(chave, Buffer.from(bytes)); }),
  storageDownload: vi.fn(async (chave: string) => {
    const b = storageStore.get(chave);
    if (!b) throw new Error(`storage download "${chave}": não encontrado`);
    return Buffer.from(b);
  }),
  storageRemove: vi.fn(async (chaves: string[]) => { for (const c of chaves) storageStore.delete(c); }),
}));

const planoFixo = {
  titulo: 'Soma com barras',
  disciplina: 'Matemática',
  resumo_para_pais: 'A Lia explica o método.',
  slides: [
    { titulo: 'Primeiro', explicacao: 'a' },
    { titulo: 'Depois', explicacao: 'b' },
  ],
};

beforeAll(async () => { await prepararBanco(); });
beforeEach(() => {
  gerarPlanoSeguro.mockReset();
  gerarPlanoSeguro.mockImplementation(async () => ({ plano: planoFixo, vazamentoNaoCorrigido: false }));
  storageStore.clear();
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

test('com saldo cria o dever, os slides e debita meia revisão', async () => {
  const conta = await createConta('Ana', 'S', 'd2@example.com', 'hash', 3);
  const res = await criarDever(post(conta.id, 'chave-1'));
  expect(res.status).toBe(200);
  const { id } = await res.json();

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2.5);

  const mov = await pool.query('SELECT quantidade, dever_id FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(mov.rows[0].quantidade).toBe(-0.5);
  expect(mov.rows[0].dever_id).toBe(id);

  const slides = await pool.query('SELECT ordem, titulo, explicacao FROM dever_slides WHERE dever_id = $1 ORDER BY ordem', [id]);
  expect(slides.rows).toHaveLength(2);
  expect(slides.rows[0].titulo).toBe('Primeiro');
  expect(slides.rows[0].explicacao).toBe('a');
});

test('saldo esgotado responde 402 e não cria dever', async () => {
  const conta = await createConta('Ana', 'S', 'd3@example.com', 'hash', 0);
  const res = await criarDever(post(conta.id, 'chave-2'));
  expect(res.status).toBe(402);
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM deveres WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(0);
});

// Meio crédito: com 0,5 de saldo o dever ainda passa (uma revisão não passaria).
test('saldo 0,5 ainda cria o dever', async () => {
  const conta = await createConta('Ana', 'S', 'd-meia@example.com', 'hash', 0.5);
  const res = await criarDever(post(conta.id, 'chave-meia'));
  expect(res.status).toBe(200);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(0);
});

test('LLM falha: nada debitado, nada persistido', async () => {
  const conta = await createConta('Ana', 'S', 'd4@example.com', 'hash', 3);
  gerarPlanoSeguro.mockRejectedValueOnce(new Error('LLM offline'));
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
  expect(rows[0].saldo_revisoes).toBe(2.5);
  expect(gerarPlanoSeguro).toHaveBeenCalledTimes(1);
});

test('corrida com a mesma chave debita exatamente uma vez', async () => {
  const conta = await createConta('Ana', 'S', 'd6@example.com', 'hash', 3);
  const [r1, r2] = await Promise.all([criarDever(post(conta.id, 'chave-5')), criarDever(post(conta.id, 'chave-5'))]);
  expect(r1.status).toBe(200);
  expect(r2.status).toBe(200);
  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2.5);
  const mov = await pool.query('SELECT count(*)::int AS c FROM movimentos_saldo WHERE conta_id = $1', [conta.id]);
  expect(mov.rows[0].c).toBe(1);
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

test('GET /api/dever/[id] devolve dever e slides ordenados', async () => {
  const a = await createConta('Ana', 'S', 'd10@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null });
  await criarSlides(pool, id, [
    { ordem: 1, titulo: 'Primeiro', explicacao: 'a' },
    { ordem: 2, titulo: 'Depois', explicacao: 'b' },
  ]);
  const res = await lerDever(reqComToken(a.id), { params: { id } });
  const corpo = await res.json();
  expect(res.status).toBe(200);
  expect(corpo.dever.disciplina).toBe('Matemática');
  expect(corpo.slides.map((s: { titulo: string }) => s.titulo)).toEqual(['Primeiro', 'Depois']);
});

test('conta B não lê dever de A', async () => {
  const a = await createConta('Ana', 'S', 'd11@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'd12@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: null, disciplina: null, conteudo_texto: 'x', resumo_para_pais: null });
  const res = await lerDever(reqComToken(b.id), { params: { id } });
  expect(res.status).toBe(404);
});

test('GET /api/deveres devolve o dever com total_slides', async () => {
  const a = await createConta('Ana', 'S', 'd17@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null });
  await criarSlides(pool, id, [
    { ordem: 1, titulo: 'Primeiro', explicacao: 'a' },
    { ordem: 2, titulo: 'Depois', explicacao: 'b' },
  ]);

  const res = await listarDeveres(reqComToken(a.id));
  expect(res.status).toBe(200);
  const corpo = await res.json();
  expect(corpo).toHaveLength(1);
  expect(corpo[0].id).toBe(id);
  expect(corpo[0].total_slides).toBe(2);
});

// ---------- Biblioteca: o dever usa o mesmo coletor da revisão ----------

import { PNG_1X1 } from '../fixtures/arquivos';

const postComMaterial = (contaId: string, campos: Array<[string, string, Buffer]>) => {
  const form = new FormData();
  form.set('texto', 'dever de matemática');
  for (const [campo, valor, bytes] of campos) {
    if (bytes.length === 0) form.append(campo, valor);
    else form.append(campo, new Blob([new Uint8Array(bytes)]), valor);
  }
  return new NextRequest('http://localhost/api/dever', {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` },
    body: form,
  });
};

test('foto do dever enviada na criação é arquivada com origem "dever"', async () => {
  const conta = await createConta('Ana', 'S', 'd19@example.com', 'hash', 3);

  const res = await criarDever(postComMaterial(conta.id, [['arquivos', 'pagina.png', PNG_1X1]]));
  expect(res.status).toBe(200);

  const { rows } = await pool.query('SELECT mime, origem FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows).toHaveLength(1);
  expect(rows[0].mime).toBe('image/png');
  expect(rows[0].origem).toBe('dever');
});

test('dever reusa item da biblioteca pelo id, sem reenviar bytes', async () => {
  const conta = await createConta('Ana', 'S', 'd20@example.com', 'hash', 3);

  await criarDever(postComMaterial(conta.id, [['arquivos', 'pagina.png', PNG_1X1]]));
  const { rows: guardado } = await pool.query('SELECT id FROM arquivos WHERE conta_id = $1', [conta.id]);

  const res = await criarDever(postComMaterial(conta.id, [['arquivoIds', guardado[0].id, Buffer.alloc(0)]]));
  expect(res.status).toBe(200);

  const { rows: contagem } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(contagem[0].c).toBe(1);
});

test('arquivoIds de outra conta responde 400 e não debita o saldo', async () => {
  const a = await createConta('Ana', 'S', 'd21@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'd22@example.com', 'hash', 3);

  await criarDever(postComMaterial(a.id, [['arquivos', 'de-a.png', PNG_1X1]]));
  const { rows: alheio } = await pool.query('SELECT id FROM arquivos WHERE conta_id = $1', [a.id]);

  const res = await criarDever(postComMaterial(b.id, [['arquivoIds', alheio[0].id, Buffer.alloc(0)]]));
  expect(res.status).toBe(400);

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [b.id]);
  expect(rows[0].saldo_revisoes).toBe(3);
});

// Insere os slides em ordem decrescente de criação: só o ORDER BY ordem de
// getSlides devolve 'Primeiro' antes de 'Depois'.
test('slides vêm em ordem crescente de ordem mesmo inseridos ao contrário', async () => {
  const a = await createConta('Ana', 'S', 'd18@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, a.id, { titulo: 'T', disciplina: 'Matemática', conteudo_texto: 'x', resumo_para_pais: null });
  await criarSlides(pool, id, [
    { ordem: 2, titulo: 'Depois', explicacao: 'b' },
    { ordem: 1, titulo: 'Primeiro', explicacao: 'a' },
  ]);

  const res = await lerDever(reqComToken(a.id), { params: { id } });
  expect(res.status).toBe(200);
  const corpo = await res.json();
  expect(corpo.slides.map((s: { titulo: string }) => s.titulo)).toEqual(['Primeiro', 'Depois']);
  expect(corpo.slides.map((s: { ordem: number }) => s.ordem)).toEqual([1, 2]);
});
