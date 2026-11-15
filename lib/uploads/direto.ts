import { createHash, randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { MAX_BYTES_POR_ARQUIVO } from '../constantes';
import { criarArquivo, getArquivoPorHash } from '../repos/arquivos';
import { Arquivo } from '../types';
import { nomeSeguroParaUpload } from './nomeSeguro';
import { MIME_POR_TIPO, detectarTipo, TipoArquivo } from './tipos';
import { Recusa, caminhoDoArquivo, ehUuid } from './biblioteca';
import { storageAssinarUpload, storageDownload, storageRemove, storageTamanhoDaChave } from './storage';

// Envio direto do navegador para o object storage, em duas etapas, porque os bytes
// não podem atravessar a rota: o Vercel corta corpo de requisição em 4.5 MB
// (FUNCTION_PAYLOAD_TOO_LARGE — devolvido pelo roteador da plataforma, antes do
// Next rodar e sem JSON, então o app nem conseguia explicar o erro). Fotos de
// celular passam disso fácil. O navegador recebe uma URL assinada, faz o PUT ele
// mesmo, e só depois o servidor registra a linha — com o hash e o tipo lidos dos
// bytes que REALMENTE subiram, não do que o cliente declarou.
//
// O preparar decide o tipo pela amostra (primeiros 64 KiB) para poder recusar lixo
// ANTES do upload, e para montar a chave com a extensão correta. O confirmar
// re-detecta no objeto inteiro: a amostra é declaração do cliente, os bytes no
// bucket são o fato. Se divergirem (amostra de JPEG, corpo de outra coisa), recusa.

export type ResultadoPreparo =
  | { ok: true; id: string; chave: string; uploadUrl: string }
  | { ok: false; recusa: Recusa };

export type ResultadoConfirmacao =
  | { ok: true; arquivo: Arquivo; duplicado: boolean }
  | { ok: false; recusa: Recusa };

export async function prepararUploadDirecto(
  dados: { contaId: string; nomeOriginal: string; tamanho: number; amostra: Buffer },
): Promise<ResultadoPreparo> {
  const recusa = (motivo: Recusa['motivo']): ResultadoPreparo =>
    ({ ok: false, recusa: { motivo, nome: dados.nomeOriginal } });

  if (!Number.isInteger(dados.tamanho) || dados.tamanho <= 0 || dados.tamanho > MAX_BYTES_POR_ARQUIVO) {
    return recusa('grande');
  }
  const tipo = detectarTipo(dados.amostra);
  if (!tipo) return recusa('tipo');

  // Id no servidor, chave canônica derivada dele: o cliente nunca compõe caminho,
  // recebe só a URL assinada (validade padrão de 2 h — sobra para 10 MB em rede de
  // celular). Se o aluno perder a conexão no meio, o PUT falha e nada foi gravado.
  const id = randomUUID();
  const chave = caminhoDoArquivo(dados.contaId, id, tipo);
  const uploadUrl = await storageAssinarUpload(chave);
  return { ok: true, id, chave, uploadUrl };
}

/**
 * Registra o arquivo cujo PUT o navegador terminou. As três defesas:
 * 1) a chave precisa ser EXATAMENTE a canônica da conta (id uuid + extensão do
 *    conjunto), senão o confirmar escreveria linha apontando para objeto alheio;
 * 2) tamanho medido no bucket antes do download (um PUT fora da nossa régua não
 *    entra na memória da função);
 * 3) tipo re-detectado do objeto inteiro e obrigado a bater com a extensão da
 *    chave — é a chave que determina o mime gravado, então os dois têm que concordar.
 * Objeto recusado é apagado: byte sem linha e sem dono não fica no bucket.
 */
export async function confirmarUploadDirecto(
  client: Pool | PoolClient,
  dados: { contaId: string; id: string; chave: string; nomeOriginal: string },
): Promise<ResultadoConfirmacao> {
  const recusa = (motivo: Recusa['motivo']): ResultadoConfirmacao =>
    ({ ok: false, recusa: { motivo, nome: dados.nomeOriginal } });
  const descartar = () => storageRemove([dados.chave]).catch(() => {});

  if (!ehUuid(dados.id)) return recusa('tipo');
  const extensao = dados.chave.slice(dados.chave.lastIndexOf('.') + 1);
  if (!Object.hasOwn(MIME_POR_TIPO, extensao)) return recusa('tipo');
  const tipoDeclarado = extensao as TipoArquivo;

  // caminhoDoArquivo joga fora qualquer chave que não seja '<raiz>/<contaId>/<id>.<tipo>'
  // da própria conta: forjar o caminho de outra conta não passa na comparação.
  let chaveCanonica: string;
  try {
    chaveCanonica = caminhoDoArquivo(dados.contaId, dados.id, tipoDeclarado);
  } catch {
    return recusa('tipo');
  }
  if (chaveCanonica !== dados.chave) return recusa('tipo');

  const tamanhoNoBucket = await storageTamanhoDaChave(dados.chave);
  if (tamanhoNoBucket === null) return recusa('ausente');
  if (tamanhoNoBucket > MAX_BYTES_POR_ARQUIVO) {
    await descartar();
    return recusa('grande');
  }

  let buffer: Buffer;
  try {
    buffer = await storageDownload(dados.chave);
  } catch {
    return recusa('ausente');
  }

  const tipo = buffer.length > 0 ? detectarTipo(buffer) : null;
  if (!tipo || tipo !== tipoDeclarado) {
    await descartar();
    return recusa('tipo');
  }

  const hash = createHash('sha256').update(buffer).digest('hex');
  const existente = await getArquivoPorHash(client, dados.contaId, hash);
  if (existente) {
    // O PUT subiu um conteúdo que a conta já tem: o objeto novo era desnecessário.
    await descartar();
    return { ok: true, arquivo: existente, duplicado: true };
  }

  try {
    const arquivo = await criarArquivo(client, {
      id: dados.id,
      contaId: dados.contaId,
      nome: nomeSeguroParaUpload(dados.nomeOriginal) || 'arquivo',
      mime: MIME_POR_TIPO[tipo],
      tamanho: buffer.length,
      caminho: dados.chave,
      hash,
      origem: 'biblioteca',
    });
    return { ok: true, arquivo, duplicado: false };
  } catch (err) {
    // Mesma ordem upload→linha com limpeza no catch de arquivarBuffer: a linha não
    // nasceu, os bytes não têm dono.
    await descartar();
    throw err;
  }
}
