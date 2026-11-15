// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as preparar } from '../../app/api/arquivos/preparar/route';
import { POST as confirmar } from '../../app/api/arquivos/confirmar/route';
import { criarArquivo } from '../../lib/repos/arquivos';
import { createConta } from '../../lib/repos/contas';
import { assinarToken } from '../../lib/auth/jwt';
import { PNG_1X1, PDF_FAKE, EXECUTAVEL_DISFARCADO } from '../fixtures/arquivos';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

// Mesmo mock de storage do arquivos-route.test.ts, com as duas funções do envio
// direto: a URL assinada vira uma URL falsa que o teste resolve escrevendo direto
// no Map (o teste é o 'PUT do navegador'), e o tamanho vem do próprio Map.
const { storageStore, assinaturas } = vi.hoisted(() => ({
  storageStore: new Map<string, { bytes: Buffer; mime: string }>(),
  assinaturas: [] as string[],
}));
vi.mock('@/lib/uploads/storage', () => ({
  bucket: () => 'uploads',
  storageUpload: vi.fn(async (chave: string, bytes: Buffer, mime: string) => {
    storageStore.set(chave, { bytes: Buffer.from(bytes), mime });
  }),
  storageDownload: vi.fn(async (chave: string) => {
    const objeto = storageStore.get(chave);
    if (!objeto) throw new Error(`storage download "${chave}": não encontrado`);
    return Buffer.from(objeto.bytes);
  }),
  storageRemove: vi.fn(async (chaves: string[]) => {
    for (const c of chaves) storageStore.delete(c);
  }),
  storageAssinarUpload: vi.fn(async (chave: string) => {
    assinaturas.push(chave);
    return `https://fake.supabase.co/upload/${encodeURIComponent(chave)}?token=teste`;
  }),
  storageTamanhoDaChave: vi.fn(async (chave: string) => storageStore.get(chave)?.bytes.length ?? null),
}));

const postJson = (url: string, contaId: string, corpo: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${assinarToken(contaId, 'user')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(corpo),
  });

const prepararArquivo = (contaId: string, corpo: { nome: string; tamanho: number; amostra: string }) =>
  preparar(postJson('http://localhost/api/arquivos/preparar', contaId, corpo));

const confirmarArquivo = (contaId: string, corpo: { id: string; chave: string; nome: string }) =>
  confirmar(postJson('http://localhost/api/arquivos/confirmar', contaId, corpo));

const amostra = (bytes: Buffer) => Buffer.from(bytes.subarray(0, 64 * 1024)).toString('base64');

// Simula o PUT do navegador na URL assinada: os bytes entram no bucket.
const simularPut = (chave: string, bytes: Buffer) => {
  storageStore.set(chave, { bytes, mime: 'application/octet-stream' });
};

beforeAll(async () => { await prepararBanco(); });
beforeEach(async () => { await limparTabelas(); storageStore.clear(); assinaturas.length = 0; });
afterAll(async () => { await pool.end(); });

test('sem token responde 401 no preparar e no confirmar', async () => {
  const semAuth = (url: string) => new NextRequest(url, { method: 'POST', body: '{}' });
  expect((await preparar(semAuth('http://localhost/api/arquivos/preparar'))).status).toBe(401);
  expect((await confirmar(semAuth('http://localhost/api/arquivos/confirmar'))).status).toBe(401);
});

test('preparar e confirmar registram o arquivo; a URL assinada sai sem segredo da conta', async () => {
  const conta = await createConta('Ana', 'S', 'd1@example.com', 'hash', 3);

  const prep = await (await prepararArquivo(conta.id, {
    nome: 'foto.png', tamanho: PNG_1X1.length, amostra: amostra(PNG_1X1),
  })).json();
  expect(prep.situacao).toBe('novo');
  expect(prep.chave).toContain(`uploads/biblioteca/${conta.id}/`);
  // A chave do objeto é o id — jamais a URL assinada — que o confirmar aceita depois.
  expect(prep.uploadUrl).toContain('https://fake.supabase.co/upload/');

  simularPut(prep.chave, PNG_1X1);
  const confRes = await confirmarArquivo(conta.id, { id: prep.id, chave: prep.chave, nome: 'foto.png' });
  expect(confRes.status).toBe(201);
  const conf = await confRes.json();
  expect(conf.situacao).toBe('criado');
  expect(conf.arquivo.nome).toBe('foto.png');
  expect(conf.arquivo.mime).toBe('image/png');
  // A resposta pública não expõe chave de storage nem hash, mesma regra do POST antigo.
  expect(conf.arquivo.caminho).toBeUndefined();
  expect(conf.arquivo.hash).toBeUndefined();

  const { rows } = await pool.query('SELECT caminho, tamanho, origem FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows).toHaveLength(1);
  expect(rows[0].caminho).toBe(prep.chave);
  expect(Number(rows[0].tamanho)).toBe(PNG_1X1.length);
  expect(rows[0].origem).toBe('biblioteca');
});

test('amostra de lixo é recusada antes de qualquer URL ser assinada', async () => {
  const conta = await createConta('Ana', 'S', 'd2@example.com', 'hash', 3);

  const res = await prepararArquivo(conta.id, {
    nome: 'disfarcado.png', tamanho: 5000, amostra: amostra(EXECUTAVEL_DISFARCADO),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ situacao: 'recusado', motivo: 'tipo' });
  // O ponto do envio direto é não gastar rede do aluno com o que seria recusado.
  expect(assinaturas).toHaveLength(0);
});

test('tamanho acima do limite é recusado no preparar, sem assinar upload', async () => {
  const conta = await createConta('Ana', 'S', 'd3@example.com', 'hash', 3);

  const res = await prepararArquivo(conta.id, {
    nome: 'grande.png', tamanho: 11 * 1024 * 1024, amostra: amostra(PNG_1X1),
  });
  expect(await res.json()).toMatchObject({ situacao: 'recusado', motivo: 'grande' });
  expect(assinaturas).toHaveLength(0);
});

test('confirmar sem o objeto no bucket recusa ausente (PUT não aconteceu)', async () => {
  const conta = await createConta('Ana', 'S', 'd4@example.com', 'hash', 3);
  const prep = await (await prepararArquivo(conta.id, {
    nome: 'foto.png', tamanho: PNG_1X1.length, amostra: amostra(PNG_1X1),
  })).json();

  const res = await confirmarArquivo(conta.id, { id: prep.id, chave: prep.chave, nome: 'foto.png' });
  expect(await res.json()).toMatchObject({ situacao: 'recusado', motivo: 'ausente' });
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(0);
});

test('chave forjada (pasta de outra conta ou extensão fora do conjunto) é recusada', async () => {
  const conta = await createConta('Ana', 'S', 'd5@example.com', 'hash', 3);
  const id = '11111111-2222-3333-4444-555555555555';

  const casos = [
    `uploads/biblioteca/${id}/${id}.png`,                        // outro conta_id
    `uploads/deveres/${conta.id}/${id}.png`,                     // fora da raiz
    `uploads/biblioteca/${conta.id}/${id}.exe`,                  // extensão desconhecida
    `uploads/biblioteca/${conta.id}/../../${id}.png`,            // traversal
    `uploads/biblioteca/${conta.id}/${id}.png.png`,              // dupla extensão
    `uploads/biblioteca/${conta.id}/${id.toUpperCase().replace(/-/g, '')}.png`, // id não-bate
  ];
  for (const chave of casos) {
    simularPut(chave, PNG_1X1);
    const res = await confirmarArquivo(conta.id, { id, chave, nome: 'invasor.png' });
    expect(await res.json()).toMatchObject({ situacao: 'recusado' });
  }
  const { rows } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(0);
});

test('objeto cujo conteúdo não bate com a extensão da chave é recusado e apagado', async () => {
  const conta = await createConta('Ana', 'S', 'd6@example.com', 'hash', 3);
  const prep = await (await prepararArquivo(conta.id, {
    nome: 'foto.png', tamanho: PNG_1X1.length, amostra: amostra(PNG_1X1),
  })).json();

  // A amostra prometida era PNG, mas o PUT subiu PDF: o confirmar lê o objeto todo.
  simularPut(prep.chave, PDF_FAKE);
  const res = await confirmarArquivo(conta.id, { id: prep.id, chave: prep.chave, nome: 'foto.png' });
  expect(await res.json()).toMatchObject({ situacao: 'recusado', motivo: 'tipo' });
  expect(storageStore.has(prep.chave)).toBe(false);
});

test('objeto maior que o limite é medido no bucket, recusado e apagado', async () => {
  const conta = await createConta('Ana', 'S', 'd7@example.com', 'hash', 3);
  const prep = await (await prepararArquivo(conta.id, {
    nome: 'foto.png', tamanho: PNG_1X1.length, amostra: amostra(PNG_1X1),
  })).json();

  const gigante = Buffer.concat([PNG_1X1, Buffer.alloc(11 * 1024 * 1024, 0x41)]);
  simularPut(prep.chave, gigante);
  const res = await confirmarArquivo(conta.id, { id: prep.id, chave: prep.chave, nome: 'foto.png' });
  expect(await res.json()).toMatchObject({ situacao: 'recusado', motivo: 'grande' });
  expect(storageStore.has(prep.chave)).toBe(false);
});

test('segundo upload do mesmo conteúdo vira duplicado e o objeto repetido é apagado', async () => {
  const conta = await createConta('Ana', 'S', 'd8@example.com', 'hash', 3);

  const primeiro = await (await prepararArquivo(conta.id, {
    nome: 'foto.png', tamanho: PNG_1X1.length, amostra: amostra(PNG_1X1),
  })).json();
  simularPut(primeiro.chave, PNG_1X1);
  const conf1 = await (await confirmarArquivo(conta.id, {
    id: primeiro.id, chave: primeiro.chave, nome: 'foto.png',
  })).json();
  expect(conf1.situacao).toBe('criado');

  // Outro id, outra chave, mesmos bytes: o hash manda.
  const segundo = await (await prepararArquivo(conta.id, {
    nome: 'copia.png', tamanho: PNG_1X1.length, amostra: amostra(PNG_1X1),
  })).json();
  expect(segundo.chave).not.toBe(primeiro.chave);
  simularPut(segundo.chave, PNG_1X1);
  const conf2Res = await confirmarArquivo(conta.id, {
    id: segundo.id, chave: segundo.chave, nome: 'copia.png',
  });
  expect(conf2Res.status).toBe(200);
  const conf2 = await conf2Res.json();
  expect(conf2.situacao).toBe('duplicado');
  expect(conf2.arquivo.id).toBe(primeiro.id);

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(1);
  expect(storageStore.size).toBe(1);
  expect(storageStore.has(segundo.chave)).toBe(false);
});

test('confirmar de outro id da mesma conta com chave alheia não cria nada', async () => {
  const conta = await createConta('Ana', 'S', 'd9@example.com', 'hash', 3);
  // Linha legítima da conta, criada por fora para ter um id/chave reais na mão.
  const idReal = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const chaveReal = `uploads/biblioteca/${conta.id}/${idReal}.png`;
  await criarArquivo(pool, {
    id: idReal, contaId: conta.id, nome: 'antigo.png', mime: 'image/png',
    tamanho: PNG_1X1.length, caminho: chaveReal, hash: 'x'.repeat(64), origem: 'biblioteca',
  });

  // Atacante tenta registrar os MESMOS bytes como arquivo 'novo': a chave canônica
  // do id que ele inventou não é a chave do arquivo alheio.
  const idNovo = '99999999-8888-7777-6666-555555555555';
  const res = await confirmarArquivo(conta.id, { id: idNovo, chave: chaveReal, nome: 'roubado.png' });
  expect(await res.json()).toMatchObject({ situacao: 'recusado', motivo: 'tipo' });

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(1);
});

test('body malformado responde 400 nas duas etapas', async () => {
  const conta = await createConta('Ana', 'S', 'd10@example.com', 'hash', 3);
  const jsonRuim = new NextRequest('http://localhost/api/arquivos/preparar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(conta.id, 'user')}`, 'content-type': 'application/json' },
    body: '{"nome":',
  });
  expect((await preparar(jsonRuim)).status).toBe(400);

  // NaN via JSON.stringify vira null: a checagem de forma da rota pega antes da
  // régua de tamanho. (A régua em si — recusa 'grande' com 200 — tem teste próprio.)
  const tamanhoRuim = await prepararArquivo(conta.id, { nome: 'x.png', tamanho: NaN, amostra: 'YWJj' });
  expect(tamanhoRuim.status).toBe(400);

  const semCorpo = await prepararArquivo(conta.id, undefined as unknown as never);
  expect(semCorpo.status).toBe(400);
});
