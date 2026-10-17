import { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Dever, DeverPasso, PassoInput, ResumoDever } from '../types';

export async function criarDever(
  client: PoolClient | Pool,
  contaId: string,
  dados: {
    titulo: string | null;
    disciplina: string | null;
    conteudo_texto: string;
    resumo_para_pais: string | null;
    chaveIdempotencia?: string | null;
  },
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO deveres (conta_id, titulo, disciplina, conteudo_texto, resumo_para_pais, chave_idempotencia)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [contaId, dados.titulo, dados.disciplina, dados.conteudo_texto, dados.resumo_para_pais,
     dados.chaveIdempotencia ?? null],
  );
  return rows[0].id as string;
}

export async function criarPassos(
  client: PoolClient | Pool, deverId: string, passos: PassoInput[],
): Promise<void> {
  for (const p of passos) {
    await client.query(
      `INSERT INTO dever_passos (dever_id, ordem, titulo, narracao, cena, audio_path, duracao_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      // Mesmo tratamento de questoes.opcoes: pg serializa array JS como literal de
      // array, que não é JSON válido para jsonb. Entrar como texto JSON.
      [deverId, p.ordem, p.titulo, p.narracao, JSON.stringify(p.cena), p.audio_path, p.duracao_ms],
    );
  }
}

export async function getDeverPorChave(
  client: PoolClient | Pool, contaId: string, chave: string,
): Promise<Dever | null> {
  const { rows } = await client.query(
    `SELECT id, conta_id, titulo, disciplina, serie_ano, conteudo_texto, resumo_para_pais,
            chave_idempotencia, criado_em
     FROM deveres WHERE conta_id = $1 AND chave_idempotencia = $2`,
    [contaId, chave],
  );
  return (rows[0] as Dever) ?? null;
}

export async function getDever(id: string, contaId: string): Promise<Dever | null> {
  const { rows } = await getPool().query(
    `SELECT id, conta_id, titulo, disciplina, serie_ano, conteudo_texto, resumo_para_pais,
            chave_idempotencia, criado_em
     FROM deveres WHERE id = $1 AND conta_id = $2`,
    [id, contaId],
  );
  return (rows[0] as Dever) ?? null;
}

// Um GROUP BY com LEFT JOIN dá a contagem de passos sem consultar tabela por
// tabela (mesmo padrão de listarRevisoesComResumo).
export async function listarDeveresComResumo(contaId: string): Promise<ResumoDever[]> {
  const { rows } = await getPool().query(
    `SELECT d.id, d.conta_id, d.titulo, d.disciplina, d.serie_ano, d.conteudo_texto,
            d.resumo_para_pais, d.chave_idempotencia, d.criado_em,
            COUNT(p.id)::int AS total_passos
     FROM deveres d
     LEFT JOIN dever_passos p ON p.dever_id = d.id
     WHERE d.conta_id = $1
     GROUP BY d.id
     ORDER BY d.criado_em DESC`,
    [contaId],
  );
  return rows as ResumoDever[];
}

export async function getPassos(deverId: string): Promise<DeverPasso[]> {
  const { rows } = await getPool().query(
    `SELECT id, dever_id, ordem, titulo, narracao, cena, audio_path, duracao_ms
     FROM dever_passos WHERE dever_id = $1 ORDER BY ordem`,
    [deverId],
  );
  return rows as DeverPasso[];
}
