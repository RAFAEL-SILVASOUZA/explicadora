import { Pool } from 'pg';

let pool: Pool | null = null;

// Lê DATABASE_URL no momento da chamada, não no import, para que os testes
// possam apontar para o banco de teste antes do primeiro uso.
export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não está definido. Copile .env.example para .env.');
    pool = new Pool({ connectionString: url });
  }
  return pool;
}
