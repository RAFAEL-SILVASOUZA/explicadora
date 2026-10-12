import { PoolClient } from 'pg';
import { getPool } from '../db/pool';

// BEGIN/COMMIT/ROLLBACK vivem na camada de dados (design.md:29, "Nenhum SQL fora
// dos repositórios"). O helper é genérico: não conhece códigos de erro de negócio,
// quem chama decide como interpretar o erro relançado (p.ex. 23505 na rota).
export async function comTransacao<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
