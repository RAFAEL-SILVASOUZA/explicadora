import { PoolClient } from 'pg';

// Saldo gratuito concedido no cadastro.
export const SALDO_INICIAL = 3;

// Preços do produto: revisão custa 1, dever de casa custa meia revisão.
export const CUSTO_REVISAO = 1;
export const CUSTO_DEVER = 0.5;

// Único lugar do sistema que decrementa o saldo. Roda dentro da transação
// aberta pelo chamador, com FOR UPDATE, para que duas requisições simultâneas
// da mesma conta não gastem o mesmo crédito. O saldo precisa cobrir o custo:
// com 0,5 dá para criar um dever, mas não para rodar uma revisão.
export async function consumirSaldo(
  client: PoolClient, contaId: string, custo: number = CUSTO_REVISAO,
): Promise<number | null> {
  const { rows } = await client.query(
    'SELECT saldo_revisoes FROM contas WHERE id = $1 FOR UPDATE',
    [contaId],
  );
  const atual = rows[0]?.saldo_revisoes as number | undefined;
  if (atual === undefined || atual < custo) return null;

  const novo = atual - custo;
  await client.query('UPDATE contas SET saldo_revisoes = $1 WHERE id = $2', [novo, contaId]);
  await client.query(
    `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade) VALUES ($1, 'consumo', $2)`,
    [contaId, -custo],
  );
  return novo;
}
