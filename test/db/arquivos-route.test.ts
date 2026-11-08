// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { GET as listarArquivos, POST as enviarArquivos } from '../../app/api/arquivos/route';
import { DELETE as excluirArquivo } from '../../app/api/arquivos/[id]/route';
import { GET as lerConteudo } from '../../app/api/arquivos/[id]/conteudo/route';
import { createConta } from '../../lib/repos/contas';
import { assinarToken } from '../../lib/auth/jwt';
import { PNG_1X1, PDF_FAKE, EXECUTAVEL_DISFARCADO } from '../fixtures/arquivos';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

const LIXO = EXECUTAVEL_DISFARCADO;

// A pasta da biblioteca de cada conta no teste, para o cleanup não depender do
// estado deixado por outro arquivo: cada teste limpa a pasta das contas que criou.
const pastasParaLimpar: string[] = [];
function registrarPasta(contaId: string) {
  pastasParaLimpar.push(path.join(process.cwd(), 'uploads', 'biblioteca', contaId));
}

const reqComToken = (contaId: string, url = 'http://localhost/api/arquivos') =>
  new NextRequest(url, { headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` } });

const postArquivos = (contaId: string, arquivos: Array<[string, Buffer]>) => {
  const form = new FormData();
  for (const [nome, conteudo] of arquivos) {
    form.append('arquivos', new Blob([new Uint8Array(conteudo)]), nome);
  }
  return new NextRequest('http://localhost/api/arquivos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` },
    body: form,
  });
};

beforeAll(async () => { await prepararBanco(); });
beforeEach(async () => { await limparTabelas(); });
afterEach(async () => {
  for (const pasta of pastasParaLimpar) await fs.rm(pasta, { recursive: true, force: true });
  pastasParaLimpar.length = 0;
});
afterAll(async () => { await pool.end(); });

test('sem token responde 401 em listar, enviar e excluir', async () => {
  expect((await listarArquivos(new NextRequest('http://localhost/api/arquivos'))).status).toBe(401);
  expect((await enviarArquivos(new NextRequest('http://localhost/api/arquivos', { method: 'POST' }))).status).toBe(401);
  expect((await excluirArquivo(
    new NextRequest('http://localhost/api/arquivos/x', { method: 'DELETE' }),
    { params: { id: 'x' } },
  )).status).toBe(401);
});

test('enviar PNG grava a linha e os bytes em uploads/biblioteca', async () => {
  const conta = await createConta('Ana', 'S', 'a1@example.com', 'hash', 3);
  registrarPasta(conta.id);

  const res = await enviarArquivos(postArquivos(conta.id, [['foto.png', PNG_1X1]]));
  expect(res.status).toBe(201);
  const corpo = await res.json();
  expect(corpo.criados).toHaveLength(1);
  expect(corpo.recusados).toHaveLength(0);
  // A resposta não expõe caminho de disco nem hash.
  expect(corpo.criados[0].caminho).toBeUndefined();
  expect(corpo.criados[0].hash).toBeUndefined();
  expect(corpo.criados[0].nome).toBe('foto.png');
  expect(corpo.criados[0].mime).toBe('image/png');
  expect(corpo.criados[0].tamanho).toBe(PNG_1X1.length);

  const { rows } = await pool.query('SELECT caminho, origem FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows).toHaveLength(1);
  expect(rows[0].origem).toBe('biblioteca');
  // Barras explícitas: o valor entra no banco e é relido em Linux (ver piper.ts).
  expect(rows[0].caminho).toContain('/');
  expect(rows[0].caminho).not.toContain('\\');

  const absoluto = path.join(process.cwd(), ...rows[0].caminho.split('/'));
  const gravado = await fs.readFile(absoluto);
  expect(gravado.equals(PNG_1X1)).toBe(true);
});

test('mesmo conteúdo enviado duas vezes não duplica bytes nem linha', async () => {
  const conta = await createConta('Ana', 'S', 'a2@example.com', 'hash', 3);
  registrarPasta(conta.id);

  const primeiro = (await (await enviarArquivos(postArquivos(conta.id, [['foto.png', PNG_1X1]]))).json()).criados[0];
  const segundoRes = await enviarArquivos(postArquivos(conta.id, [['copia-de-foto.png', PNG_1X1]]));
  const segundo = await segundoRes.json();

  expect(segundo.criados).toHaveLength(0);
  expect(segundo.duplicados).toHaveLength(1);
  // O item devolvido é o primeiro: a segunda foto não virou arquivo novo.
  expect(segundo.duplicados[0].id).toBe(primeiro.id);

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(1);
  const pasta = path.join(process.cwd(), 'uploads', 'biblioteca', conta.id);
  const nomes = await fs.readdir(pasta);
  expect(nomes).toHaveLength(1);
});

test('PDF é aceito e arquivo desconhecido é recusado', async () => {
  const conta = await createConta('Ana', 'S', 'a3@example.com', 'hash', 3);
  registrarPasta(conta.id);

  const res = await enviarArquivos(postArquivos(conta.id, [
    ['apostila.pdf', PDF_FAKE],
    ['disfarcado.png', LIXO],
  ]));
  expect(res.status).toBe(201);
  const corpo = await res.json();
  expect(corpo.criados.map((a: { nome: string }) => a.nome)).toEqual(['apostila.pdf']);
  expect(corpo.recusados).toHaveLength(1);
  expect(corpo.recusados[0].motivo).toBe('tipo');

  const { rows } = await pool.query('SELECT mime FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows).toHaveLength(1);
  expect(rows[0].mime).toBe('application/pdf');
});

test('arquivo acima do limite de tamanho é recusado', async () => {
  const conta = await createConta('Ana', 'S', 'a4@example.com', 'hash', 3);
  registrarPasta(conta.id);
  // PNG válido + cauda para passar dos 10 MB: o magic number continua de PNG, então
  // a recusa tem que vir do tamanho, não do tipo.
  const gigante = Buffer.concat([PNG_1X1, Buffer.alloc(11 * 1024 * 1024, 0x41)]);

  const res = await enviarArquivos(postArquivos(conta.id, [['grande.png', gigante]]));
  expect(res.status).toBe(400);
  const corpo = await res.json();
  expect(corpo.error).toContain('Nenhum arquivo foi aceito');
  expect(corpo.recusados[0].motivo).toBe('grande');

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(0);
});

test('GET lista só os arquivos da conta da sessão', async () => {
  const a = await createConta('Ana', 'S', 'a5@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'a6@example.com', 'hash', 3);
  registrarPasta(a.id);
  registrarPasta(b.id);

  await enviarArquivos(postArquivos(a.id, [['de-a.png', PNG_1X1]]));
  await enviarArquivos(postArquivos(b.id, [['de-b.pdf', PDF_FAKE]]));

  const listaA = await (await listarArquivos(reqComToken(a.id))).json();
  expect(listaA).toHaveLength(1);
  expect(listaA[0].nome).toBe('de-a.png');
  const listaB = await (await listarArquivos(reqComToken(b.id))).json();
  expect(listaB).toHaveLength(1);
  expect(listaB[0].nome).toBe('de-b.pdf');
});

test('conteudo devolve os bytes com mime e Vary: Authorization; outra conta toma 404', async () => {
  const a = await createConta('Ana', 'S', 'a7@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'a8@example.com', 'hash', 3);
  registrarPasta(a.id);

  const criado = (await (await enviarArquivos(postArquivos(a.id, [['foto.png', PNG_1X1]]))).json()).criados[0];

  const resA = await lerConteudo(reqComToken(a.id, `http://localhost/api/arquivos/${criado.id}/conteudo`), { params: { id: criado.id } });
  expect(resA.status).toBe(200);
  expect(resA.headers.get('content-type')).toBe('image/png');
  expect(resA.headers.get('vary')).toBe('Authorization');
  const bytes = Buffer.from(await resA.arrayBuffer());
  expect(bytes.equals(PNG_1X1)).toBe(true);

  const resB = await lerConteudo(reqComToken(b.id, `http://localhost/api/arquivos/${criado.id}/conteudo`), { params: { id: criado.id } });
  expect(resB.status).toBe(404);
});

test('DELETE remove a linha e o arquivo do disco; segunda exclusão toma 404', async () => {
  const conta = await createConta('Ana', 'S', 'a9@example.com', 'hash', 3);
  registrarPasta(conta.id);

  const criado = (await (await enviarArquivos(postArquivos(conta.id, [['foto.png', PNG_1X1]]))).json()).criados[0];
  const { rows: antes } = await pool.query('SELECT caminho FROM arquivos WHERE id = $1', [criado.id]);
  const absoluto = path.join(process.cwd(), ...antes[0].caminho.split('/'));
  expect(await fs.readFile(absoluto) !== null).toBe(true);

  const res = await excluirArquivo(
    reqComToken(conta.id, `http://localhost/api/arquivos/${criado.id}`),
    { params: { id: criado.id } },
  );
  expect(res.status).toBe(200);

  const { rows: depois } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE id = $1', [criado.id]);
  expect(depois[0].c).toBe(0);
  let sumiu = false;
  try { await fs.access(absoluto); } catch { sumiu = true; }
  expect(sumiu).toBe(true);

  const res2 = await excluirArquivo(
    reqComToken(conta.id, `http://localhost/api/arquivos/${criado.id}`),
    { params: { id: criado.id } },
  );
  expect(res2.status).toBe(404);
});

test('DELETE de outra conta não remove o arquivo (404)', async () => {
  const a = await createConta('Ana', 'S', 'a10@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'a11@example.com', 'hash', 3);
  registrarPasta(a.id);

  const criado = (await (await enviarArquivos(postArquivos(a.id, [['foto.png', PNG_1X1]]))).json()).criados[0];
  const res = await excluirArquivo(reqComToken(b.id, `http://localhost/api/arquivos/${criado.id}`), { params: { id: criado.id } });
  expect(res.status).toBe(404);

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM arquivos WHERE id = $1', [criado.id]);
  expect(rows[0].c).toBe(1);
});

test('id malformado na exclusão e no conteúdo responde 404 sem tocar o disco', async () => {
  const conta = await createConta('Ana', 'S', 'a12@example.com', 'hash', 3);
  for (const id of ['../../etc/passwd', 'x', '']) {
    const del = await excluirArquivo(reqComToken(conta.id), { params: { id } });
    expect(del.status).toBe(404);
    const conteudo = await lerConteudo(reqComToken(conta.id), { params: { id } });
    expect(conteudo.status).toBe(404);
  }
});

test('envio sem arquivos responde 400', async () => {
  const conta = await createConta('Ana', 'S', 'a13@example.com', 'hash', 3);
  const res = await enviarArquivos(new NextRequest('http://localhost/api/arquivos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${assinarToken(conta.id, 'user')}` },
    body: new FormData(),
  }));
  expect(res.status).toBe(400);
});
