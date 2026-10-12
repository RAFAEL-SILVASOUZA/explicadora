import { PoolClient } from 'pg';
import { getPool } from '../db/pool';

export type TipoMovimento = 'registro' | 'resgate' | 'consumo';

export async function registrarMovimento(
  client: PoolClient,
  contaId: string,
  tipo: TipoMovimento,
  quantidade: number,
  opts: { token_id?: string; revisao_id?: string } = {},
): Promise<void> {
  await client.query(
    `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade, token_id, revisao_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [contaId, tipo, quantidade, opts.token_id ?? null, opts.revisao_id ?? null],
  );
}

export function extratoConta(contaId: string) {
  return getPool().query(
    `SELECT tipo, quantidade, token_id, revisao_id, criado_em
     FROM movimentos_saldo WHERE conta_id = $1 ORDER BY criado_em DESC`,
    [contaId],
  );
}
