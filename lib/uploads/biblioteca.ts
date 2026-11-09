import { createHash, randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { MAX_BYTES_POR_ARQUIVO } from '../constantes';
import { criarArquivo, getArquivoPorHash } from '../repos/arquivos';
import { Arquivo } from '../types';
import { nomeSeguroParaUpload } from './nomeSeguro';
import { MIME_POR_TIPO, detectarTipo, TipoArquivo } from './tipos';
import { storageDownload, storageRemove, storageUpload } from './storage';

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

// Barras explícitas, não path.join: este valor é GRAVADO em arquivos.caminho e é a
// chave do objeto no Supabase Storage. Em storage a chave é sempre separada por '/';
// um backslash viraria parte literal do nome. O mesmo valor serve de chave de leitura.
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
 * conteúdo, deduplica por hash, sobe os bytes para o object storage e registra a linha.
 *
 * Ordem upload→linha com limpeza no catch: o object storage não entra na transação do
 * Postgres. O caminho inverso deixaria uma linha apontando para um objeto que nunca foi
 * escrito. O storageUpload usa upsert: um reenvio do mesmo id substitui o objeto, sem
 * deixar duas versões do mesmo caminho.
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
  const chave = caminhoDoArquivo(dados.contaId, id, tipo);

  await storageUpload(chave, dados.buffer, MIME_POR_TIPO[tipo]);

  try {
    const arquivo = await criarArquivo(client, {
      id,
      contaId: dados.contaId,
      nome: nomeExibicao,
      mime: MIME_POR_TIPO[tipo],
      tamanho: dados.buffer.length,
      caminho: chave,
      hash,
      origem: dados.origem,
    });
    return { ok: true, arquivo, duplicado: false };
  } catch (err) {
    // A linha não nasceu: os bytes não têm dono. Remover agora evita objeto órfão.
    await storageRemove([chave]).catch(() => {});
    throw err;
  }
}

/**
 * Lê os bytes de um arquivo já registrado. O caminho (chave do objeto) vem do nosso
 * banco, mas a guarda é barata e mantém o leitor cego a qualquer valor fora da raiz da
 * biblioteca (defesa em profundidade: um caminho forjado não leria outros buckets/raízes).
 */
export async function lerBytesDoArquivo(arquivo: Arquivo): Promise<Buffer> {
  if (!arquivo.caminho.startsWith(`${RAIZ}/`)) {
    throw new Error('caminho de arquivo fora da biblioteca');
  }
  return storageDownload(arquivo.caminho);
}

export async function apagarBytesDoArquivo(arquivo: Arquivo): Promise<void> {
  if (!arquivo.caminho.startsWith(`${RAIZ}/`)) return;
  await storageRemove([arquivo.caminho]);
  // "Pasta por conta" não existe em object storage (o prefixo é virtual): nada a limpar.
}

// Reexportado para as rotas poderem tipar sem importar lib/uploads/tipos direto.
export type { TipoArquivo };
