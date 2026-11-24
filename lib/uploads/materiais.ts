import { MAX_ARQUIVOS_POR_ENVIO, MAX_IMAGENS } from '../constantes';

// Limite de caracteres de texto extraído de PDFs: PDFs grandes geram prompts
// gigantes (custo e latência). 20k caracteres cobrem um dever de casa inteiro.
const MAX_TEXTO_PDF = 20_000;
import { getPool } from '../db/pool';
import { ImagemProcessada } from '../llm';
import { processarImagem } from '../imagem';
import { extrairTextoPDF } from '../pdf';
import { getArquivoPorId } from '../repos/arquivos';
import { arquivarBuffer, ehUuid, lerBytesDoArquivo, OrigemArquivo } from './biblioteca';
import { detectarTipo } from './tipos';

export interface Materiais {
  texto: string;
  imagens: ImagemProcessada[];
  avisos: string[];
  hashes: string[];
  // Ids dos itens da biblioteca que alimentaram o material, na ordem em que chegaram.
  // É o que permite a um dever reler as próprias fotos na regeneração.
  ids: string[];
}

/**
 * Pedido inválido: a rota devolve 400 em vez de tentar criar, e não transforma um
 * problema do cliente em 500.
 */
export class MaterialInvalido extends Error {}

interface Fonte {
  nome: string;
  buffer: Buffer;
}

/**
 * Monta o material de uma criação de revisão/dever a partir das duas fontes:
 *
 *  - `arquivoIds`: itens que já estão na biblioteca da conta. O servidor relê os bytes
 *    do disco; é isto que dispensa reenviar o mesmo material.
 *  - `arquivos`: bytes novos, que passam a ser arquivados automaticamente na
 *    biblioteca (decisão do produto: nada é enviado duas vezes).
 *
 * Os ids vêm antes dos bytes novos porque o formulário mostra a biblioteca primeiro,
 * e a ordem chegou até a LLM como a ordem do aluno.
 *
 * MAX_IMAGENS é compartilhado entre as duas fontes: é o teto do contexto de visão da
 * LLM, não um limite por fonte.
 *
 * Um id inexistente ou de outra conta é erro de pedido. Arquivo ilegível em disco vira
 * aviso e o material restante segue: um PDF corrompido não derruba a criação dos
 * outros nove arquivos bons.
 */
export async function coletarMateriais(
  formData: FormData,
  contaId: string,
  origem: OrigemArquivo,
): Promise<Materiais> {
  const pool = getPool();
  const ids = formData.getAll('arquivoIds') as string[];
  const novos = formData.getAll('arquivos') as File[];

  if (ids.length + novos.length > MAX_ARQUIVOS_POR_ENVIO) {
    throw new MaterialInvalido(`Envie no máximo ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.`);
  }

  const avisos: string[] = [];
  const fontes: Fonte[] = [];
  const hashes: string[] = [];
  const idsArquivo: string[] = [];

  for (const bruto of ids) {
    if (!ehUuid(bruto)) throw new MaterialInvalido('Selecione arquivos válidos da sua biblioteca.');
    const arquivo = await getArquivoPorId(pool, bruto, contaId);
    if (!arquivo) throw new MaterialInvalido('Um dos arquivos selecionados não está na sua biblioteca.');
    try {
      const buffer = await lerBytesDoArquivo(arquivo);
      fontes.push({ nome: arquivo.nome, buffer });
      hashes.push(arquivo.hash);
      idsArquivo.push(arquivo.id);
    } catch {
      avisos.push(`Não consegui ler "${arquivo.nome}" do seu arquivo salvo.`);
    }
  }

  for (const file of novos) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const guardado = await arquivarBuffer(pool, { contaId, nomeOriginal: file.name, buffer, origem });
    if (!guardado.ok) {
      avisos.push(
        guardado.recusa.motivo === 'grande'
          ? `"${file.name}" é grande demais.`
          : `"${file.name}" não é uma imagem ou PDF reconhecido.`,
      );
      continue;
    }
    fontes.push({ nome: guardado.arquivo.nome, buffer });
    hashes.push(guardado.arquivo.hash);
    idsArquivo.push(guardado.arquivo.id);
  }

  const processado = await processarFontes(fontes, (formData.get('texto') as string) || '');

  return {
    texto: processado.texto,
    imagens: processado.imagens,
    avisos: [...avisos, ...processado.avisos],
    hashes,
    ids: idsArquivo,
  };
}

/**
 * Bytes já carregados em texto + imagens. É o miolo da criação e da recarga: os
 * tetos (MAX_TEXTO_PDF por PDF, MAX_IMAGENS no total) e os avisos de arquivo
 * ilegível precisam ser os mesmos dos dois caminhos, senão a regeneração explicaria
 * o dever com um material diferente do que o aluno enviou.
 */
async function processarFontes(
  fontes: Fonte[], textoInicial: string,
): Promise<{ texto: string; imagens: ImagemProcessada[]; avisos: string[] }> {
  const avisos: string[] = [];
  let texto = textoInicial;
  const imagens: ImagemProcessada[] = [];

  for (const fonte of fontes) {
    // O tipo vem do conteúdo, não da coluna mime: a mesma defesa do upload vale na
    // leitura, e o custo é inspecionar os primeiros bytes.
    const tipo = detectarTipo(fonte.buffer);
    if (!tipo) {
      avisos.push(`"${fonte.nome}" não é uma imagem ou PDF reconhecido.`);
      continue;
    }
    if (tipo === 'pdf') {
      try {
        const textoPDF = await extrairTextoPDF(fonte.buffer);
        const textoLimitado = textoPDF.slice(0, MAX_TEXTO_PDF);
        if (textoPDF.length > MAX_TEXTO_PDF) {
          avisos.push(`PDF "${fonte.nome}" é grande demais: só os primeiros ${MAX_TEXTO_PDF} caracteres foram usados.`);
        }
        texto += `\n\n--- Conteúdo do PDF: ${fonte.nome} ---\n${textoLimitado}`;
      } catch {
        avisos.push(`Não consegui ler o texto do PDF "${fonte.nome}".`);
      }
      continue;
    }
    if (imagens.length >= MAX_IMAGENS) {
      avisos.push(`Máximo de ${MAX_IMAGENS} imagens atingido: "${fonte.nome}" não foi usada.`);
      continue;
    }
    try {
      const { base64, mime } = await processarImagem(fonte.buffer);
      imagens.push({ base64, mime });
    } catch {
      avisos.push(`Não consegui ler a imagem "${fonte.nome}".`);
    }
  }

  return { texto, imagens, avisos };
}

/**
 * Reconstrói as imagens e os hashes do material de um dever a partir dos ids
 * arquivados na criação. Sem isto a regeneração só teria o texto digitado, e um
 * dever criado a partir de foto não teria nada para a LLM reler.
 *
 * O texto fica de fora de propósito: deveres.conteudo_texto já é o texto montado na
 * criação (enunciado + extrações de PDF). Somar as extrações de novo duplicaria o
 * conteúdo enviado ao modelo.
 *
 * A posse entra na leitura de cada id: um arquivo que deixou de existir vira aviso e
 * o restante segue, mesma política da criação.
 */
export async function recarregarMateriais(
  contaId: string, arquivoIds: string[],
): Promise<{ imagens: ImagemProcessada[]; hashes: string[]; avisos: string[] }> {
  const pool = getPool();
  const avisos: string[] = [];
  const fontes: Fonte[] = [];
  const hashes: string[] = [];

  for (const id of arquivoIds) {
    if (!ehUuid(id)) continue;
    const arquivo = await getArquivoPorId(pool, id, contaId);
    if (!arquivo) {
      avisos.push('Um dos arquivos originais não está mais na sua biblioteca.');
      continue;
    }
    try {
      fontes.push({ nome: arquivo.nome, buffer: await lerBytesDoArquivo(arquivo) });
      hashes.push(arquivo.hash);
    } catch {
      avisos.push(`Não consegui ler "${arquivo.nome}" do seu arquivo salvo.`);
    }
  }

  const processado = await processarFontes(fontes, '');

  return { imagens: processado.imagens, hashes, avisos: [...avisos, ...processado.avisos] };
}
