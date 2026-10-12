import { getPool } from './pool';
import { hashSenha } from '../auth/senha';

export async function semearAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  if (!email || !senha) {
    console.warn('ADMIN_EMAIL/ADMIN_SENHA não definidos: conta admin não criada.');
    return;
  }
  const pool = getPool();
  const { rowCount } = await pool.query(
    `INSERT INTO contas (email, senha_hash, role, saldo_revisoes)
     VALUES ($1, $2, 'admin', 0)
     ON CONFLICT (email) DO NOTHING`,
    [email.toLowerCase().trim(), await hashSenha(senha)],
  );
  if (rowCount) console.log(`Conta admin criada: ${email}`);
}
