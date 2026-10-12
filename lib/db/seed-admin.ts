import { Pool } from 'pg';
import { getPool } from './pool';
import { hashSenha } from '../auth/senha';

// Silencioso: quem chama decide o que logar (CLI de migrate.ts, instrumentation.ts
// na Task 14). O pool é opcional para que os testes passem o pool do helper em vez
// de depender do singleton de getPool(), que nunca é fechado.
export async function semearAdmin(pool?: Pool): Promise<boolean> {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  if (!email || !senha) return false;
  const p = pool ?? getPool();
  const { rowCount } = await p.query(
    `INSERT INTO contas (email, senha_hash, role, saldo_revisoes)
     VALUES ($1, $2, 'admin', 0)
     ON CONFLICT (email) DO NOTHING`,
    [email.toLowerCase().trim(), await hashSenha(senha)],
  );
  return Boolean(rowCount);
}
