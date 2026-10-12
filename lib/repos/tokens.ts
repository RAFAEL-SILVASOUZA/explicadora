import { getPool } from '../db/pool';

export interface TokenView {
  id: string;
  codigo: string;
  plano_codigo: string;
  status: 'disponivel' | 'resgatado' | 'expirado';
  expira_em: string;
  resgatado_por: string | null;
  resgatado_em: string | null;
}

const COLUNAS = `
  id, codigo, plano_codigo, criado_em,
  CASE WHEN resgatado_por IS NOT NULL THEN 'resgatado'
       WHEN expira_em < now() THEN 'expirado'
       ELSE 'disponivel' END AS status,
  expira_em, resgatado_por, resgatado_em
`;

// Alfabeto sem caracteres ambíguos (0/O, 1/I) para a pessoa conseguir digitar o código.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function codigoDeToken(planoCodigo: string): string {
  const parte = () =>
    Array.from({ length: 4 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
  return `${planoCodigo.toUpperCase()}-${parte()}-${parte()}`;
}

export async function gerarLote(
  criadoPor: string, planoCodigo: string, quantidade: number, expiraEm: Date,
): Promise<TokenView[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lote = await client.query(
      'INSERT INTO lotes (criado_por, quantidade) VALUES ($1, $2) RETURNING id',
      [criadoPor, quantidade],
    );
    const codigos = Array.from({ length: quantidade }, () => codigoDeToken(planoCodigo));
    const { rows } = await client.query(
      `INSERT INTO tokens (codigo, plano_codigo, lote_id, expira_em, criado_por)
       SELECT unnest($1::text[]), $2, $3, $4, $5
       RETURNING ${COLUNAS}`,
      [codigos, planoCodigo, lote.rows[0].id, expiraEm, criadoPor],
    );
    await client.query('COMMIT');
    return rows as TokenView[];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export type ResgateResultado =
  | { ok: true; plano: string; revisoes: number; novoSaldo: number }
  | { ok: false; motivo: 'nao_encontrado' | 'ja_resgatado' | 'expirado' };

export async function resgateToken(codigo: string, contaId: string): Promise<ResgateResultado> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const token = await client.query(
      `SELECT id, plano_codigo, expira_em, resgatado_por FROM tokens WHERE codigo = $1 FOR UPDATE`,
      [codigo.trim().toUpperCase()],
    );
    const t = token.rows[0];
    if (!t) { await client.query('ROLLBACK'); return { ok: false, motivo: 'nao_encontrado' }; }
    if (t.resgatado_por) { await client.query('ROLLBACK'); return { ok: false, motivo: 'ja_resgatado' }; }
    if (new Date(t.expira_em) < new Date()) { await client.query('ROLLBACK'); return { ok: false, motivo: 'expirado' }; }

    const plano = await client.query('SELECT codigo, revisoes FROM planos WHERE codigo = $1', [t.plano_codigo]);
    const revisoes = plano.rows[0].revisoes as number;

    await client.query('UPDATE tokens SET resgatado_por = $1, resgatado_em = now() WHERE id = $2', [contaId, t.id]);
    await client.query('UPDATE contas SET saldo_revisoes = saldo_revisoes + $1 WHERE id = $2', [revisoes, contaId]);
    await client.query(
      `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade, token_id) VALUES ($1, 'resgate', $2, $3)`,
      [contaId, revisoes, t.id],
    );
    const conta = await client.query('SELECT saldo_revisoes FROM contas WHERE id = $1 FOR UPDATE', [contaId]);
    await client.query('COMMIT');
    return { ok: true, plano: t.plano_codigo, revisoes, novoSaldo: conta.rows[0].saldo_revisoes as number };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listarTokens(): Promise<TokenView[]> {
  const { rows } = await getPool().query(`SELECT ${COLUNAS} FROM tokens ORDER BY criado_em DESC`);
  return rows as TokenView[];
}
