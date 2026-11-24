// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { pool, prepararBanco, limparTabelas } from './helper';
import { POST as criarDever } from '../../app/api/dever/route';
import { POST as regenerarDever } from '../../app/api/dever/[id]/regenerar/route';
import { criarDever as criarDeverRepo } from '../../lib/repos/deveres';
import { createConta } from '../../lib/repos/contas';
import { assinarToken } from '../../lib/auth/jwt';
import { hashConteudo } from '../../lib/deveres/cache';
import { PNG_1X1 } from '../fixtures/arquivos';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

// Mock pelos mesmos specifiers que as rotas importam (mesmo motivo de
// dever-route.test.ts). gerarPlanoSeguro recebe as imagens: e por elas que o teste
// prova que a regeneracao rele as fotos originais.
const { gerarPlanoSeguro } = vi.hoisted(() => ({ gerarPlanoSeguro: vi.fn() }));
vi.mock('@/lib/deveres/llm', () => ({ gerarPlanoSeguro }));

const { storageStore } = vi.hoisted(() => ({ storageStore: new Map<string, Buffer>() }));
vi.mock('@/lib/uploads/storage', () => ({
  bucket: () => 'uploads',
  storageUpload: vi.fn(async (chave: string, bytes: Buffer) => { storageStore.set(chave, Buffer.from(bytes)); }),
  storageDownload: vi.fn(async (chave: string) => {
    const b = storageStore.get(chave);
    if (!b) throw new Error('storage download nao encontrado');
    return Buffer.from(b);
  }),
  storageRemove: vi.fn(async (chaves: string[]) => { for (const c of chaves) storageStore.delete(c); }),
}));

function planoCom(titulo: string) {
  return {
    titulo,
    disciplina: 'Matematica',
    resumo_para_pais: 'A Lia explica o metodo.',
    slides: [
      { titulo: 'Primeiro', explicacao: 'a' },
      { titulo: 'Depois', explicacao: 'b' },
    ],
  };
}

beforeAll(async () => { await prepararBanco(); });
beforeEach(() => {
  gerarPlanoSeguro.mockReset();
  gerarPlanoSeguro.mockImplementation(async () => ({ plano: planoCom('Soma com barras'), vazamentoNaoCorrigido: false }));
  storageStore.clear();
});
afterEach(async () => { await limparTabelas(); });
afterAll(async () => { await pool.end(); });

const postDever = (contaId: string, campos: Array<[string, string, Buffer]> = []) => {
  const form = new FormData();
  form.set('texto', 'dever de matematica');
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

// A rota e um handler de rota dinamica: o segundo argumento com o id e obrigatorio,
// exatamente como em dever-route.test.ts.
const chamarRegenerar = (contaId: string, id: string) =>
  regenerarDever(
    new NextRequest('http://localhost/api/dever/' + id + '/regenerar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${assinarToken(contaId, 'user')}` },
    }),
    { params: { id } },
  );

// Cria um dever a partir de uma foto e devolve o id. O texto do formulario e o
// mesmo em todos os testes para a chave de cache ser comparavel.
async function criarDeverComFoto(contaId: string): Promise<string> {
  const res = await criarDever(postDever(contaId, [['arquivos', 'pagina.png', PNG_1X1]]));
  expect(res.status).toBe(200);
  return (await res.json()).id as string;
}

// ---------- O caso de uso principal: regenerar um dever criado so por foto ----------

test('dever criado por foto regenera, e a LLM recebe as fotos originais', async () => {
  const conta = await createConta('Ana', 'S', 'r1@example.com', 'hash', 3);
  const id = await criarDeverComFoto(conta.id);
  gerarPlanoSeguro.mockClear();

  const res = await chamarRegenerar(conta.id, id);
  expect(res.status).toBe(200);

  expect(gerarPlanoSeguro).toHaveBeenCalledTimes(1);
  const [texto, imagens] = gerarPlanoSeguro.mock.calls[0] as [string, unknown[]];
  expect(texto).toBe('dever de matematica');
  // O ponto do teste: antes da recarga de materiais isto era um array vazio, e o
  // botao "gerar nova versao" falhava exatamente no dever fotografado.
  expect(imagens).toHaveLength(1);
});

test('regenerar substitui os slides e debita meia revisao', async () => {
  const conta = await createConta('Ana', 'S', 'r2@example.com', 'hash', 3);
  const id = await criarDeverComFoto(conta.id);
  gerarPlanoSeguro.mockResolvedValue({ plano: planoCom('Outra explicacao'), vazamentoNaoCorrigido: false });

  const res = await chamarRegenerar(conta.id, id);
  expect(res.status).toBe(200);

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(2);

  const slides = await pool.query('SELECT explicacao FROM dever_slides WHERE dever_id = $1 ORDER BY ordem', [id]);
  expect(slides.rows).toHaveLength(2);

  const mov = await pool.query(
    'SELECT quantidade, dever_id FROM movimentos_saldo WHERE conta_id = $1 ORDER BY criado_em DESC',
    [conta.id],
  );
  expect(mov.rows[0].quantidade).toBe(-0.5);
  expect(mov.rows[0].dever_id).toBe(id);
});

test('regenerar zera a leitura para a explicacao nova comecar do zero', async () => {
  const conta = await createConta('Ana', 'S', 'r3@example.com', 'hash', 3);
  const id = await criarDeverComFoto(conta.id);
  await pool.query('UPDATE deveres SET lido_ate = 2, concluido = true WHERE id = $1', [id]);

  await chamarRegenerar(conta.id, id);

  const { rows } = await pool.query('SELECT lido_ate, concluido FROM deveres WHERE id = $1', [id]);
  expect(rows[0].lido_ate).toBe(0);
  expect(rows[0].concluido).toBe(false);
});

test('sem saldo responde 402 e mantem os slides originais', async () => {
  const conta = await createConta('Ana', 'S', 'r4@example.com', 'hash', 1);
  const id = await criarDeverComFoto(conta.id);
  await pool.query('UPDATE contas SET saldo_revisoes = 0 WHERE id = $1', [conta.id]);

  const res = await chamarRegenerar(conta.id, id);
  expect(res.status).toBe(402);

  const slides = await pool.query('SELECT explicacao FROM dever_slides WHERE dever_id = $1 ORDER BY ordem', [id]);
  expect(slides.rows.map((r) => r.explicacao)).toEqual(['a', 'b']);
});

test('conta B nao regenera dever de A', async () => {
  const a = await createConta('Ana', 'S', 'r5@example.com', 'hash', 3);
  const b = await createConta('Bob', 'T', 'r6@example.com', 'hash', 3);
  const id = await criarDeverComFoto(a.id);
  gerarPlanoSeguro.mockClear();

  const res = await chamarRegenerar(b.id, id);
  expect(res.status).toBe(404);
  expect(gerarPlanoSeguro).not.toHaveBeenCalled();
});

// ---------- Cache: o plano novo substitui o antigo ----------

test('regenerar atualiza o cache: reenviar o mesmo conteudo devolve o plano novo', async () => {
  const conta = await createConta('Ana', 'S', 'r7@example.com', 'hash', 5);
  const id = await criarDeverComFoto(conta.id);

  // A chave que a criacao gravou: e a mesma que a regeneracao precisa recomputar.
  const { rows: arquivos } = await pool.query('SELECT hash FROM arquivos WHERE conta_id = $1', [conta.id]);
  const chave = hashConteudo('dever de matematica', [arquivos[0].hash], 'crianca');

  gerarPlanoSeguro.mockResolvedValue({ plano: planoCom('Explicacao refeita'), vazamentoNaoCorrigido: false });
  expect((await chamarRegenerar(conta.id, id)).status).toBe(200);

  const { rows: cache } = await pool.query(
    'SELECT plano FROM dever_cache WHERE conta_id = $1 AND hash = $2',
    [conta.id, chave],
  );
  expect(cache).toHaveLength(1);
  expect(cache[0].plano.titulo).toBe('Explicacao refeita');

  // O reenvio cai no cache e nao passa pela LLM: e o que prova que a regeneracao
  // trocou a entrada em vez de deixar a antiga servir.
  gerarPlanoSeguro.mockClear();
  const reenvio = await criarDever(postDever(conta.id, [['arquivos', 'pagina.png', PNG_1X1]]));
  expect(reenvio.status).toBe(200);
  expect(gerarPlanoSeguro).not.toHaveBeenCalled();
});

// Um plano neutralizado (a auditoria nao consertou o vazamento) e o pior resultado
// possivel para aquele conteudo. Guarda-lo serviria o slide quebrado para sempre.
test('plano com vazamento nao corrigido nao entra no cache', async () => {
  const conta = await createConta('Ana', 'S', 'r8@example.com', 'hash', 5);
  const id = await criarDeverComFoto(conta.id);
  await pool.query('DELETE FROM dever_cache WHERE conta_id = $1', [conta.id]);

  gerarPlanoSeguro.mockResolvedValue({ plano: planoCom('Ainda vaza'), vazamentoNaoCorrigido: true });
  const res = await chamarRegenerar(conta.id, id);
  expect(res.status).toBe(200);
  expect((await res.json()).vazamentoNaoCorrigido).toBe(true);

  const { rows } = await pool.query('SELECT count(*)::int AS c FROM dever_cache WHERE conta_id = $1', [conta.id]);
  expect(rows[0].c).toBe(0);
});

// ---------- Material perdido ----------

test('dever sem texto e sem arquivos responde 400 e nao debita', async () => {
  const conta = await createConta('Ana', 'S', 'r9@example.com', 'hash', 3);
  const id = await criarDeverRepo(pool, conta.id, {
    titulo: null, disciplina: null, conteudo_texto: '', resumo_para_pais: null,
  });

  const res = await chamarRegenerar(conta.id, id);
  expect(res.status).toBe(400);
  expect(gerarPlanoSeguro).not.toHaveBeenCalled();

  const { rows } = await pool.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [conta.id]);
  expect(rows[0].saldo_revisoes).toBe(3);
});

// O arquivo foi apagado da biblioteca depois da criacao: o texto salvo ainda
// regenera, e o aviso nao derruba a explicacao.
test('arquivo apagado da biblioteca nao impede a regeneracao pelo texto', async () => {
  const conta = await createConta('Ana', 'S', 'r10@example.com', 'hash', 3);
  const id = await criarDeverComFoto(conta.id);
  await pool.query('DELETE FROM arquivos WHERE conta_id = $1', [conta.id]);
  gerarPlanoSeguro.mockClear();

  const res = await chamarRegenerar(conta.id, id);
  expect(res.status).toBe(200);

  const [, imagens] = gerarPlanoSeguro.mock.calls[0] as [string, unknown[]];
  expect(imagens).toHaveLength(0);
});
