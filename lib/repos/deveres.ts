import { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Dever, DeverSlide, NivelAluno, ResumoDever, SlideInput } from '../types';

export async function criarDever(
  client: PoolClient | Pool,
  contaId: string,
  dados: {
    titulo: string | null;
    disciplina: string | null;
    conteudo_texto: string;
    resumo_para_pais: string | null;
    chaveIdempotencia?: string | null;
    nivel?: NivelAluno;
    arquivoIds?: string[];
  },
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO deveres (conta_id, titulo, disciplina, nivel, conteudo_texto, resumo_para_pais,
                          chave_idempotencia, arquivo_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [contaId, dados.titulo, dados.disciplina, dados.nivel ?? 'crianca', dados.conteudo_texto, dados.resumo_para_pais,
     dados.chaveIdempotencia ?? null, dados.arquivoIds ?? []],
  );
  return rows[0].id as string;
}

export async function criarSlides(
  client: PoolClient | Pool, deverId: string, slides: SlideInput[],
): Promise<void> {
  for (const s of slides) {
    await client.query(
      `INSERT INTO dever_slides (dever_id, ordem, titulo, explicacao)
       VALUES ($1, $2, $3, $4)`,
      [deverId, s.ordem, s.titulo, s.explicacao],
    );
  }
}

const COLUNAS_DEVER = `id, conta_id, titulo, disciplina, serie_ano, nivel, conteudo_texto, resumo_para_pais,
            chave_idempotencia, arquivo_ids, lido_ate, concluido, criado_em`;

export async function getDeverPorChave(
  client: PoolClient | Pool, contaId: string, chave: string,
): Promise<Dever | null> {
  const { rows } = await client.query(
    `SELECT ${COLUNAS_DEVER}
     FROM deveres WHERE conta_id = $1 AND chave_idempotencia = $2`,
    [contaId, chave],
  );
  return (rows[0] as Dever) ?? null;
}

export async function getDever(id: string, contaId: string): Promise<Dever | null> {
  const { rows } = await getPool().query(
    `SELECT ${COLUNAS_DEVER}
     FROM deveres WHERE id = $1 AND conta_id = $2`,
    [id, contaId],
  );
  return (rows[0] as Dever) ?? null;
}

// Um GROUP BY com LEFT JOIN dá a contagem de slides sem consultar tabela por
// tabela (mesmo padrão de listarRevisoesComResumo).
export async function listarDeveresComResumo(contaId: string): Promise<ResumoDever[]> {
  const { rows } = await getPool().query(
    `SELECT d.id, d.conta_id, d.titulo, d.disciplina, d.serie_ano, d.nivel, d.conteudo_texto,
            d.resumo_para_pais, d.chave_idempotencia, d.arquivo_ids, d.lido_ate, d.concluido, d.criado_em,
            COUNT(s.id)::int AS total_slides
     FROM deveres d
     LEFT JOIN dever_slides s ON s.dever_id = d.id
     WHERE d.conta_id = $1
     GROUP BY d.id
     ORDER BY d.criado_em DESC`,
    [contaId],
  );
  return rows as ResumoDever[];
}

// O clamp acontece no SQL, não na rota: lido_ate é a quantidade de slides lidos, e
// um valor maior que o total (chamada direta à API, ou um dever regenerado que ficou
// com menos slides) faria a barra de progresso da grid passar dos 100%.
export async function atualizarLeitura(
  client: PoolClient | Pool, deverId: string, lidoAte: number, concluido: boolean,
): Promise<void> {
  await client.query(
    `UPDATE deveres
        SET lido_ate = LEAST($1, (SELECT COUNT(*)::int FROM dever_slides WHERE dever_id = $3)),
            concluido = $2
      WHERE id = $3`,
    [lidoAte, concluido, deverId],
  );
}

export async function regenerarSlides(
  client: PoolClient | Pool, deverId: string, slides: SlideInput[],
): Promise<void> {
  await client.query('DELETE FROM dever_slides WHERE dever_id = $1', [deverId]);
  for (const s of slides) {
    await client.query(
      `INSERT INTO dever_slides (dever_id, ordem, titulo, explicacao)
       VALUES ($1, $2, $3, $4)`,
      [deverId, s.ordem, s.titulo, s.explicacao],
    );
  }
}

// A regeneração substitui os slides do dever. O cache é chaveado por conteúdo, e a
// rota recomputa a chave a partir do texto e dos arquivos relidos, então não há
// coluna para guardar aqui.

// Ruling: sem contaId; só pode ser chamada depois que o dever foi resolvido por conta
// (posse validada pela rota). Mesma convenção de getQuestoes/getRespostas em revisoes.ts.
export async function getSlides(deverId: string): Promise<DeverSlide[]> {
  const { rows } = await getPool().query(
    `SELECT id, dever_id, ordem, titulo, explicacao
     FROM dever_slides WHERE dever_id = $1 ORDER BY ordem`,
    [deverId],
  );
  return rows as DeverSlide[];
}
