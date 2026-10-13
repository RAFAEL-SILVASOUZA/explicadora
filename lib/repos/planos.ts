import { getPool } from '../db/pool';
import { Plano } from '../types';

// O SQL fica no repositório (Ruling Q): a rota só chama esta função.
export async function listarPlanos(): Promise<Plano[]> {
  const { rows } = await getPool().query(
    'SELECT codigo, nome, revisoes, preco_cents FROM planos ORDER BY preco_cents, revisoes',
  );
  return rows as Plano[];
}
