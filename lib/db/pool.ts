import { Pool, types } from 'pg';

// int8 (oid 20) chega como string por padrão no node-postgres. As colunas id das
// questões/respostas são bigint GENERATED ALWAYS AS IDENTITY e o tipo declarado em
// lib/types.ts é number, então o parser converte para number: sem isso, `q.id === questaoId`
// compararia string com number nas rotas da Task 9. Number() perde precisão acima de
// 2^53, o que não acontece com IDs de identidade em produção.
types.setTypeParser(20, (v: string) => Number(v));

// numeric (oid 1700) também chega como string por padrão. saldo_revisoes e
// movimentos_saldo.quantidade ganharam meia-revisão (numeric(6,1), migration
// 008) e são declarados number em todo o código; com meio ponto em binário,
// 0.5 é exato, então parseFloat não acumula erro nesses valores.
types.setTypeParser(1700, (v: string) => parseFloat(v));

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
