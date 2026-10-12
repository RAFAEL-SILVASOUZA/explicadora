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
    // Ruling TT: um ROLLBACK que lança substituiria o erro original, e o chamador perderia
    // a checagem de 23505 (um 409 viraria 500). O erro do rollback é engolido de propósito:
    // o erro que motivou o rollback é o que a rota precisa ver.
    try {
      await client.query('ROLLBACK');
    } catch {
      // sem efeito: o erro de rollback não substitui o erro original.
    }
    throw err;
  } finally {
    client.release();
  }
}
