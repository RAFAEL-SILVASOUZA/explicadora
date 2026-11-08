import { MAX_ARQUIVOS_POR_ENVIO, MAX_IMAGENS } from '../constantes';
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

  for (const bruto of ids) {
    if (!ehUuid(bruto)) throw new MaterialInvalido('Selecione arquivos válidos da sua biblioteca.');
    const arquivo = await getArquivoPorId(pool, bruto, contaId);
    if (!arquivo) throw new MaterialInvalido('Um dos arquivos selecionados não está na sua biblioteca.');
    try {
      fontes.push({ nome: arquivo.nome, buffer: await lerBytesDoArquivo(arquivo) });
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
  }

  let texto = (formData.get('texto') as string) || '';
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
        texto += `\n\n--- Conteúdo do PDF: ${fonte.nome} ---\n${await extrairTextoPDF(fonte.buffer)}`;
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
