import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { getPool } from './pool';
import { semearAdmin } from './seed-admin';

const DIR = path.join(process.cwd(), 'migrations');

export async function aplicarMigracoes(pool?: Pool): Promise<void> {
  const p = pool ?? getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const arquivos = (await fs.readdir(DIR)).filter(f => f.endsWith('.sql')).sort();
  for (const name of arquivos) {
    const jaAplicada = await p.query('SELECT 1 FROM migrations WHERE name = $1', [name]);
    if (jaAplicada.rowCount) continue;
    const sql = await fs.readFile(path.join(DIR, name), 'utf8');
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migração ${name} falhou: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  aplicarMigracoes()
    .then(semearAdmin)
    .then(() => process.exit(0))
    .catch((err) => { console.error(err.message); process.exit(1); });
}
