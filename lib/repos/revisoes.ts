import { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { QuestaoInput, Resposta, Revisao, Questao } from '../types';

// O escopo aceita Pool além de PoolClient: os chamadores que não estão dentro de
// uma transação (e os testes) passam o pool direto.
export async function criarRevisao(
  client: PoolClient | Pool, contaId: string, conteudoTexto: string, titulo: string | null,
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO revisoes (conta_id, titulo, conteudo_texto) VALUES ($1, $2, $3) RETURNING id`,
    [contaId, titulo, conteudoTexto],
  );
  return rows[0].id as string;
}

export async function getRevisao(id: string, contaId: string): Promise<Revisao | null> {
  const { rows } = await getPool().query(
    'SELECT id, conta_id, titulo, conteudo_texto, criado_em FROM revisoes WHERE id = $1 AND conta_id = $2',
    [id, contaId],
  );
  return (rows[0] as Revisao) ?? null;
}

export async function listarRevisoes(contaId: string): Promise<Revisao[]> {
  const { rows } = await getPool().query(
    `SELECT id, conta_id, titulo, conteudo_texto, criado_em FROM revisoes
     WHERE conta_id = $1 ORDER BY criado_em DESC`,
    [contaId],
  );
  return rows as Revisao[];
}

// Ruling O: sem contaId; só pode ser chamada depois que a revisão foi resolvida por conta.
export async function getQuestoes(revisaoId: string): Promise<Questao[]> {
  const { rows } = await getPool().query(
    `SELECT id, revisao_id, tipo, enunciado, opcoes, resposta_correta, dica, ordem
     FROM questoes WHERE revisao_id = $1 ORDER BY ordem`,
    [revisaoId],
  );
  return rows as Questao[];
}

// Ruling O: sem contaId; só pode ser chamada depois que a revisão foi resolvida por conta.
export async function getRespostas(revisaoId: string): Promise<Resposta[]> {
  const { rows } = await getPool().query(
    `SELECT r.id, r.questao_id, r.resposta_dada, r.correto, r.explicacao, r.respondida_em
     FROM respostas r JOIN questoes q ON r.questao_id = q.id
     WHERE q.revisao_id = $1`,
    [revisaoId],
  );
  return rows as Resposta[];
}

export async function getRevisaoCompleta(id: string, contaId: string) {
  const revisao = await getRevisao(id, contaId);
  if (!revisao) return null;
  return { revisao, questoes: await getQuestoes(id), respostas: await getRespostas(id) };
}

export async function createQuestoes(
  client: PoolClient | Pool, revisaoId: string, questoes: QuestaoInput[], ordemInicial: number,
): Promise<void> {
  for (const [i, q] of questoes.entries()) {
    await client.query(
      `INSERT INTO questoes (revisao_id, tipo, enunciado, opcoes, resposta_correta, dica, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      // node-postgres serializa um array JS como literal de array de Postgres
      // ({A,B}), que não é JSON válido para a coluna jsonb: o array entra como texto
      // JSON. Na leitura, pg já devolve o jsonb como array JS.
      [revisaoId, q.tipo, q.enunciado, JSON.stringify(q.opcoes), q.resposta_correta, q.dica || '', ordemInicial + i],
    );
  }
}

// Ruling O: sem contaId; só pode ser chamada depois que a revisão foi resolvida por conta.
export async function createResposta(
  questaoId: number, respostaDada: string, correto: boolean, explicacao: string,
): Promise<void> {
  await getPool().query(
    `INSERT INTO respostas (questao_id, resposta_dada, correto, explicacao) VALUES ($1, $2, $3, $4)`,
    [questaoId, respostaDada, correto, explicacao],
  );
}

// Ruling O: sem contaId; só pode ser chamada depois que a revisão foi resolvida por conta.
export async function getScore(revisaoId: string): Promise<{ acertos: number; total: number }> {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS total FROM questoes WHERE revisao_id = $1`,
    [revisaoId],
  );
  const total = rows[0].total as number;
  const acertosRow = await getPool().query(
    `SELECT COUNT(*)::int AS acertos FROM respostas r
     JOIN questoes q ON r.questao_id = q.id
     WHERE q.revisao_id = $1 AND r.correto`,
    [revisaoId],
  );
  return { acertos: acertosRow.rows[0].acertos as number, total };
}

// Ruling O: sem contaId; só pode ser chamada depois que a revisão foi resolvida por conta.
export async function limparRespostas(revisaoId: string): Promise<void> {
  await getPool().query(
    `DELETE FROM respostas WHERE questao_id IN (SELECT id FROM questoes WHERE revisao_id = $1)`,
    [revisaoId],
  );
}
