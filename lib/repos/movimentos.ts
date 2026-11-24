import { PoolClient } from 'pg';
import { getPool } from '../db/pool';

export type TipoMovimento = 'registro' | 'resgate' | 'consumo' | 'revogacao';

export async function registrarMovimento(
  client: PoolClient,
  contaId: string,
  tipo: TipoMovimento,
  quantidade: number,
  opts: { token_id?: string; revisao_id?: string; pedido_id?: string } = {},
): Promise<void> {
  await client.query(
    `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade, token_id, revisao_id, pedido_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [contaId, tipo, quantidade, opts.token_id ?? null, opts.revisao_id ?? null, opts.pedido_id ?? null],
  );
}

// Liga o movimento de consumo recém-criado à revisão que o gerou. O movimento é
// inserido por consumirSaldo sem revisao_id; o vínculo acontece depois que a
// revisão existe. `dever_id IS NULL` espelha vincularMovimentoADever: sem ele, o
// UPDATE da próxima revisão roubaria um consumo já commitado a um dever,
// corrompendo o extrato.
export async function vincularMovimentoARevisao(
  client: PoolClient, contaId: string, revisaoId: string, movimentoId?: number,
): Promise<void> {
  if (movimentoId !== undefined) {
    await client.query(
      `UPDATE movimentos_saldo SET revisao_id = $1 WHERE id = $2 AND conta_id = $3`,
      [revisaoId, movimentoId, contaId],
    );
    return;
  }
  await client.query(
    `UPDATE movimentos_saldo SET revisao_id = $1
     WHERE conta_id = $2 AND tipo = $3 AND revisao_id IS NULL AND dever_id IS NULL`,
    [revisaoId, contaId, 'consumo'],
  );
}

// Igual ao vínculo da revisão: consumirSaldo insere o movimento sem referência e
// o vínculo acontece depois que o dever existe.
export async function vincularMovimentoADever(
  client: PoolClient, contaId: string, deverId: string, movimentoId?: number,
): Promise<void> {
  if (movimentoId !== undefined) {
    await client.query(
      `UPDATE movimentos_saldo SET dever_id = $1 WHERE id = $2 AND conta_id = $3`,
      [deverId, movimentoId, contaId],
    );
    return;
  }
  await client.query(
    `UPDATE movimentos_saldo SET dever_id = $1
     WHERE conta_id = $2 AND tipo = $3 AND dever_id IS NULL AND revisao_id IS NULL`,
    [deverId, contaId, 'consumo'],
  );
}

// O join com tokens e pedidos_pagamento traz plano_codigo: é o que permite
// a rota /api/conta mostrar o plano do último resgate (seja via token ou via Mercado Pago).
export function extratoConta(contaId: string) {
  return getPool().query(
    `SELECT m.tipo, m.quantidade, m.token_id, m.revisao_id, m.dever_id, m.pedido_id,
            COALESCE(t.plano_codigo, p.plano_codigo) AS plano_codigo,
            m.criado_em
     FROM movimentos_saldo m
     LEFT JOIN tokens t ON t.id = m.token_id
     LEFT JOIN pedidos_pagamento p ON p.id = m.pedido_id
     WHERE m.conta_id = $1 ORDER BY m.criado_em DESC`,
    [contaId],
  );
}
