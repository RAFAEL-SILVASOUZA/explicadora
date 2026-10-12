import { getPool } from '../db/pool';

export interface TokenView {
  id: string;
  codigo: string;
  plano_codigo: string;
  status: 'disponivel' | 'resgatado' | 'expirado';
  expira_em: string;
  resgatado_por: string | null;
  resgatado_em: string | null;
  criado_em: string;
}

// A linha da área admin: a mesma TokenView mais o email de quem resgatou.
export interface TokenAdminView extends TokenView {
  resgatado_por_email: string | null;
}

// O CASE do status fica aqui, em um lugar só. O prefixo é opcional porque no join do
// admin `id` seria ambíguo entre tokens e contas.
const colunas = (prefixo?: string): string => {
  const p = prefixo ? `${prefixo}.` : '';
  return `
    ${p}id, ${p}codigo, ${p}plano_codigo, ${p}criado_em,
    CASE WHEN ${p}resgatado_por IS NOT NULL THEN 'resgatado'
         WHEN ${p}expira_em < now() THEN 'expirado'
         ELSE 'disponivel' END AS status,
    ${p}expira_em, ${p}resgatado_por, ${p}resgatado_em
  `;
};

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
       RETURNING ${colunas()}`,
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

// Ruling GG: `planos` é tabela de referência, não enum no código (spec linha 76).
// O SQL da consulta fica no repositório (Ruling Q); a rota só chama esta função.
export async function planoExiste(codigo: string): Promise<boolean> {
  const { rows } = await getPool().query('SELECT 1 FROM planos WHERE codigo = $1', [codigo]);
  return rows.length > 0;
}

export async function listarTokens(): Promise<TokenView[]> {
  const { rows } = await getPool().query(`SELECT ${colunas()} FROM tokens ORDER BY criado_em DESC`);
  return rows as TokenView[];
}

// A listagem da área admin: o mesmo status derivado de `colunas()`, mais o email de quem
// resgatou. O join fica no repositório, não na rota.
export async function listarTokensComEmail(): Promise<TokenAdminView[]> {
  const { rows } = await getPool().query(
    `SELECT ${colunas('t')}, c.email AS resgatado_por_email
     FROM tokens t LEFT JOIN contas c ON c.id = t.resgatado_por
     ORDER BY t.criado_em DESC`
  );
  return rows as TokenAdminView[];
}
