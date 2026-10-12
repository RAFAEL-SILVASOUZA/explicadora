import { Pool } from 'pg';
import { aplicarMigracoes } from '../../lib/db/migrate';

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
  || 'postgres://estudo:estudo@localhost:5404/estudo_test';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// `migrations` fica fora da lista: é o registro permanente das migrações aplicadas,
// não dados de teste.
const TABELAS = ['contas', 'planos', 'lotes', 'tokens', 'revisoes', 'questoes', 'respostas', 'movimentos_saldo'];

// Os três planos do negócio, os mesmos valores de migrations/001_initial.sql.
const PLANOS: Array<[string, string, number, number]> = [
  ['free', 'Free', 3, 0],
  ['pro', 'Pro', 20, 500],
  ['familia', 'Família', 50, 1500],
];

export async function semearPlanos(): Promise<void> {
  for (const [codigo, nome, revisoes, preco_cents] of PLANOS) {
    await pool.query(
      `INSERT INTO planos (codigo, nome, revisoes, preco_cents) VALUES ($1, $2, $3, $4)
       ON CONFLICT (codigo) DO NOTHING`,
      [codigo, nome, revisoes, preco_cents],
    );
  }
}

// Cada arquivo de teste parte do mesmo estado conhecido, definido por ele mesmo:
// migrações aplicadas, tabelas limpas e os planos semeado. Nenhum arquivo depende
// do que o afterEach de outro arquivo deixou no banco.
export async function prepararBanco(): Promise<void> {
  await aplicarMigracoes(pool);
  await limparTabelas();
  await semearPlanos();
}

export async function limparTabelas(): Promise<void> {
  await pool.query(`TRUNCATE ${TABELAS.join(', ')} RESTART IDENTITY CASCADE`);
}
