// lib/repos/pedidos.ts
// Repositório de pedidos de pagamento — SQL isolado, sem lógica de negócio.
import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Pedido } from '../types';

export async function criarPedido(
  client: PoolClient,
  contaId: string,
  planoCodigo: string,
  mpOrderId: string,
  pedidoId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO pedidos_pagamento (id, conta_id, plano_codigo, mp_order_id)
     VALUES ($1, $2, $3, $4)`,
    [pedidoId, contaId, planoCodigo, mpOrderId],
  );
}

export async function buscarPedidoPorMpOrder(mpOrderId: string): Promise<Pedido | null> {
  const { rows } = await getPool().query(
    `SELECT p.id, p.conta_id, p.plano_codigo, p.mp_order_id, p.status,
            p.criado_em, p.atualizado_em, pl.revisoes
     FROM pedidos_pagamento p
     JOIN planos pl ON pl.codigo = p.plano_codigo
     WHERE p.mp_order_id = $1`,
    [mpOrderId],
  );
  return (rows[0] as Pedido) ?? null;
}

// Muda status de 'pending' → 'approved'. Retorna quantas linhas foram afetadas
// (0 = já processado antes, proteção idempotência).
export async function aprovarPedido(
  client: PoolClient,
  pedidoId: string,
): Promise<number> {
  const { rowCount } = await client.query(
    `UPDATE pedidos_pagamento
     SET status = 'approved', atualizado_em = now()
     WHERE id = $1 AND status = 'pending'`,
    [pedidoId],
  );
  return rowCount ?? 0;
}
