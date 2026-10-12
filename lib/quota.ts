import { PoolClient } from 'pg';

// Saldo gratuito concedido no cadastro.
export const SALDO_INICIAL = 3;

// Único lugar do sistema que decrementa o saldo. Roda dentro da transação
// aberta pelo chamador, com FOR UPDATE, para que duas requisições simultâneas
// da mesma conta não gastem a mesma revisão.
export async function consumirSaldo(client: PoolClient, contaId: string): Promise<number | null> {
  const { rows } = await client.query(
    'SELECT saldo_revisoes FROM contas WHERE id = $1 FOR UPDATE',
    [contaId],
  );
  const atual = rows[0]?.saldo_revisoes as number | undefined;
  if (!atual || atual <= 0) return null;

  const novo = atual - 1;
  await client.query('UPDATE contas SET saldo_revisoes = $1 WHERE id = $2', [novo, contaId]);
  await client.query(
    `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade) VALUES ($1, 'consumo', -1)`,
    [contaId],
  );
  return novo;
}
