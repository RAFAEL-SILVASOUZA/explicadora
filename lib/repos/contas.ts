import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { Conta, Role } from '../types';

export async function createConta(
  nome: string, sobrenome: string, email: string, senhaHash: string, saldo: number, client?: PoolClient,
): Promise<Conta> {
  const p = client ?? getPool();
  const { rows } = await p.query(
    `INSERT INTO contas (nome, sobrenome, email, senha_hash, saldo_revisoes) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nome, sobrenome, email, role, saldo_revisoes, criado_em`,
    [nome.trim(), sobrenome.trim(), email.toLowerCase().trim(), senhaHash, saldo],
  );
  return rows[0] as Conta;
}

export async function findContaByEmail(email: string): Promise<Conta | null> {
  // senha_hash entra na seleção porque o login precisa comparar; as rotas nunca
  // devolvem esse campo (ver contaPublica() na Task 8).
  const { rows } = await getPool().query(
    `SELECT id, nome, sobrenome, email, role, saldo_revisoes, criado_em, senha_hash FROM contas WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return (rows[0] as Conta) ?? null;
}

export function contaPublica(c: Conta): {
  id: string; nome: string; sobrenome: string; email: string; role: Role; saldo_revisoes: number; criado_em: string;
} {
  return {
    id: c.id, nome: c.nome, sobrenome: c.sobrenome, email: c.email,
    role: c.role, saldo_revisoes: c.saldo_revisoes, criado_em: c.criado_em,
  };
}

export async function findContaById(id: string): Promise<Conta | null> {
  const { rows } = await getPool().query(
    `SELECT id, nome, sobrenome, email, role, saldo_revisoes, criado_em FROM contas WHERE id = $1`,
    [id],
  );
  return (rows[0] as Conta) ?? null;
}
