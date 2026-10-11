import { Pool } from 'pg';
import { aplicarMigracoes } from '../../lib/db/migrate';

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
  || 'postgres://estudo:estudo@localhost:5404/estudo_test';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TABELAS = ['contas', 'planos', 'lotes', 'tokens', 'revisoes', 'questoes', 'respostas', 'movimentos_saldo'];

export async function prepararBanco(): Promise<void> {
  await aplicarMigracoes(pool);
}

export async function limparTabelas(): Promise<void> {
  await pool.query(`TRUNCATE ${TABELAS.join(', ')} RESTART IDENTITY CASCADE`);
}
