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

// Liga o movimento de consumo recém-criado à revisão que o gerou. O movimento é
// inserido por consumirSaldo sem revisao_id; o vínculo acontece depois que a
// revisão existe.
export async function vincularMovimentoARevisao(
  client: PoolClient, contaId: string, revisaoId: string,
): Promise<void> {
  await client.query(
    `UPDATE movimentos_saldo SET revisao_id = $1
     WHERE conta_id = $2 AND tipo = $3 AND revisao_id IS NULL`,
    [revisaoId, contaId, 'consumo'],
  );
}

export function extratoConta(contaId: string) {
  return getPool().query(
    `SELECT tipo, quantidade, token_id, revisao_id, criado_em
     FROM movimentos_saldo WHERE conta_id = $1 ORDER BY criado_em DESC`,
    [contaId],
  );
}
