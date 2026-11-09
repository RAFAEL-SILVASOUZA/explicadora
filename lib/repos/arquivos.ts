import { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Arquivo } from '../types';

// Mesmo shape dos demais repositórios: funções livres que recebem client ou pool,
// nunca decidem HTTP. A posse (conta_id) entra no WHERE de toda leitura: um id de
// outra conta devolve null, e a rota responde 404 sem revelar que o id existe.

export async function criarArquivo(
  client: PoolClient | Pool,
  dados: {
    // O id é gerado no servidor (crypto.randomUUID) antes dos bytes serem escritos:
    // o caminho em disco depende dele. Sem isso precisaríamos de duas idas ao banco
    // para saber o caminho. Passar id exige que ele seja uuid, o que a rota garante.
    id: string;
    contaId: string;
    nome: string;
    mime: string;
    tamanho: number;
    caminho: string;
    hash: string;
    origem: string;
  },
): Promise<Arquivo> {
  const { rows } = await client.query(
    `INSERT INTO arquivos (id, conta_id, nome, mime, tamanho, caminho, hash, origem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, conta_id, nome, mime, tamanho, caminho, hash, origem, criado_em`,
    [dados.id, dados.contaId, dados.nome, dados.mime, dados.tamanho, dados.caminho,
     dados.hash, dados.origem],
  );
  return rows[0] as Arquivo;
}

export async function getArquivoPorId(
  client: PoolClient | Pool, id: string, contaId: string,
): Promise<Arquivo | null> {
  const { rows } = await client.query(
    `SELECT id, conta_id, nome, mime, tamanho, caminho, hash, origem, criado_em
     FROM arquivos WHERE id = $1 AND conta_id = $2`,
    [id, contaId],
  );
  return (rows[0] as Arquivo) ?? null;
}

// Dedupe por conteúdo. Sem índice único: a checagem é aqui, e uma corrida entre dois
// envios idênticos só duplica o arquivo em disco (ver migration 006).
export async function getArquivoPorHash(
  client: PoolClient | Pool, contaId: string, hash: string,
): Promise<Arquivo | null> {
  const { rows } = await client.query(
    `SELECT id, conta_id, nome, mime, tamanho, caminho, hash, origem, criado_em
     FROM arquivos WHERE conta_id = $1 AND hash = $2
     ORDER BY criado_em ASC
     LIMIT 1`,
    [contaId, hash],
  );
  return (rows[0] as Arquivo) ?? null;
}

export async function listarArquivos(contaId: string): Promise<Arquivo[]> {
  const { rows } = await getPool().query(
    `SELECT id, conta_id, nome, mime, tamanho, caminho, hash, origem, criado_em
     FROM arquivos WHERE conta_id = $1 ORDER BY criado_em DESC`,
    [contaId],
  );
  return rows as Arquivo[];
}

// Renomeio: só a coluna de exibição muda — a chave no object storage é montada a
// partir do id, nunca do nome, então os bytes não são tocados. A posse entra no
// WHERE como em toda operação daqui: UPDATE em id de outra conta não toca linha.
export async function renomearArquivo(
  client: PoolClient | Pool, id: string, contaId: string, nome: string,
): Promise<Arquivo | null> {
  const { rows } = await client.query(
    `UPDATE arquivos SET nome = $3 WHERE id = $1 AND conta_id = $2
     RETURNING id, conta_id, nome, mime, tamanho, caminho, hash, origem, criado_em`,
    [id, contaId, nome],
  );
  return (rows[0] as Arquivo) ?? null;
}

// Devolve a linha removida (o chamador apaga o arquivo do disco com o caminho dela).
// RETURNING na DELETE: uma única ida ao banco e a posse validada no mesmo WHERE.
export async function removerArquivo(
  client: PoolClient | Pool, id: string, contaId: string,
): Promise<Arquivo | null> {
  const { rows } = await client.query(
    `DELETE FROM arquivos WHERE id = $1 AND conta_id = $2
     RETURNING id, conta_id, nome, mime, tamanho, caminho, hash, origem, criado_em`,
    [id, contaId],
  );
  return (rows[0] as Arquivo) ?? null;
}
