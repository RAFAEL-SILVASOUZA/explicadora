import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Pool, PoolClient } from 'pg';
import { MAX_BYTES_POR_ARQUIVO } from '../constantes';
import { criarArquivo, getArquivoPorHash } from '../repos/arquivos';
import { Arquivo } from '../types';
import { nomeSeguroParaUpload } from './nomeSeguro';
import { MIME_POR_TIPO, detectarTipo, TipoArquivo } from './tipos';

// A pasta da biblioteca fica sob uploads/ (fora de public/, que é servido sem
// autenticação) e separada de uploads/deveres (WAVs do Piper) e dos arquivos soltos
// que a rota de revisão gravava antes da migration 006.
const RAIZ = 'uploads/biblioteca';

export type OrigemArquivo = 'biblioteca' | 'revisao' | 'dever';

// UUID regex, o mesmo critério de lib/deveres/piper.ts: id e contaId vêm do banco,
// mas caminho é montado a partir deles. Um uuid forjado ('../../etc') escreveria fora
// de uploads/biblioteca/.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: string): boolean {
  return UUID_RE.test(valor);
}

// Barras explícitas, não path.join: este valor é GRAVADO em arquivos.caminho e relido
// por outro SO. path.join no host Windows produz backslash, que o container Linux não
// trata como separador (a lição está comentada em caminhoDoAudio). fs.readFile aceita
// '/' no Windows, então barra funciona nas duas pontas.
export function caminhoDoArquivo(contaId: string, id: string, tipo: TipoArquivo): string {
  if (!ehUuid(contaId) || !ehUuid(id)) throw new Error('identificador inválido para caminho de arquivo');
  return `${RAIZ}/${contaId}/${id}.${tipo}`;
}

export type RecusaMotivo = 'grande' | 'tipo';

export interface Recusa {
  motivo: RecusaMotivo;
  nome: string;
}

export type ResultadoArquivamento =
  | { ok: true; arquivo: Arquivo; duplicado: boolean }
  | { ok: false; recusa: Recusa };

/**
 * Grava um buffer na biblioteca da conta: valida tamanho, detecta o tipo pelo
 * conteúdo, deduplica por hash, escreve os bytes e registra a linha.
 *
 * Ordem escrita→linha com limpeza no catch: o sistema de arquivos não entra na
 * transação do Postgres. O caminho inverso deixaria uma linha apontando para um
 * arquivo que nunca foi escrito.
 */
export async function arquivarBuffer(
  client: Pool | PoolClient,
  dados: { contaId: string; nomeOriginal: string; buffer: Buffer; origem: OrigemArquivo },
): Promise<ResultadoArquivamento> {
  const nomeExibicao = nomeSeguroParaUpload(dados.nomeOriginal) || 'arquivo';

  if (dados.buffer.length === 0) {
    return { ok: false, recusa: { motivo: 'tipo', nome: dados.nomeOriginal } };
  }
  if (dados.buffer.length > MAX_BYTES_POR_ARQUIVO) {
    return { ok: false, recusa: { motivo: 'grande', nome: dados.nomeOriginal } };
  }

  const tipo = detectarTipo(dados.buffer);
  if (!tipo) return { ok: false, recusa: { motivo: 'tipo', nome: dados.nomeOriginal } };

  const hash = createHash('sha256').update(dados.buffer).digest('hex');
  const existente = await getArquivoPorHash(client, dados.contaId, hash);
  if (existente) return { ok: true, arquivo: existente, duplicado: true };

  const id = randomUUID();
  const relativo = caminhoDoArquivo(dados.contaId, id, tipo);
  // O caminho relativo usa barras; para o fs, resolver contra process.cwd().
  const absoluto = path.join(process.cwd(), ...relativo.split('/'));

  try {
    await fs.mkdir(path.dirname(absoluto), { recursive: true });
    await fs.writeFile(absoluto, dados.buffer);
  } catch (err) {
    await fs.rm(absoluto, { force: true }).catch(() => {});
    throw err;
  }

  try {
    const arquivo = await criarArquivo(client, {
      id,
      contaId: dados.contaId,
      nome: nomeExibicao,
      mime: MIME_POR_TIPO[tipo],
      tamanho: dados.buffer.length,
      caminho: relativo,
      hash,
      origem: dados.origem,
    });
    return { ok: true, arquivo, duplicado: false };
  } catch (err) {
    // A linha não nasceu: os bytes não têm dono. Remover agora evita órfão.
    await fs.rm(absoluto, { force: true }).catch(() => {});
    throw err;
  }
}

/**
 * Lê os bytes de um arquivo já registrado. O caminho vem do nosso banco, mas a
 * guarda é barata e mantém o leitor cego a qualquer valor fora da raiz da biblioteca.
 */
export async function lerBytesDoArquivo(arquivo: Arquivo): Promise<Buffer> {
  if (!arquivo.caminho.startsWith(`${RAIZ}/`)) {
    throw new Error('caminho de arquivo fora da biblioteca');
  }
  const absoluto = path.join(process.cwd(), ...arquivo.caminho.split('/'));
  return fs.readFile(absoluto);
}

export async function apagarBytesDoArquivo(arquivo: Arquivo): Promise<void> {
  if (!arquivo.caminho.startsWith(`${RAIZ}/`)) return;
  const absoluto = path.join(process.cwd(), ...arquivo.caminho.split('/'));
  await fs.rm(absoluto, { force: true });
  // A pasta por conta fica para trás se vazia: removê-la é cosmético e pode falhar
  // em corrida com outro upload; o custo de deixar uma pasta vazia é zero.
}

// Reexportado para as rotas poderem tipar sem importar lib/uploads/tipos direto.
export type { TipoArquivo };
