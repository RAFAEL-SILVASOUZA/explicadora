import { randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';
import { getPool } from '../db/pool';

export type TokenStatus = 'disponivel' | 'resgatado' | 'expirado' | 'revogado';

export interface TokenView {
  id: string;
  codigo: string;
  plano_codigo: string;
  status: TokenStatus;
  expira_em: string;
  resgatado_por: string | null;
  resgatado_em: string | null;
  revogado_em: string | null;
  criado_em: string;
}

// A linha da área admin: a mesma TokenView mais o email de quem resgatou e o quanto desse
// resgate ele já gastou.
export interface TokenAdminView extends TokenView {
  resgatado_por_email: string | null;
  usados: number;
}

// O CASE do status fica aqui, em um lugar só. O prefixo é opcional porque no join do
// admin `id` seria ambíguo entre tokens e contas. `revogado` vem antes de `resgatado`:
// um código revogado foi resgatado antes, e o que importa para a linha é o estado final.
const colunas = (prefixo?: string): string => {
  const p = prefixo ? `${prefixo}.` : '';
  return `
    ${p}id, ${p}codigo, ${p}plano_codigo, ${p}criado_em,
    CASE WHEN ${p}revogado_em IS NOT NULL THEN 'revogado'
         WHEN ${p}resgatado_por IS NOT NULL THEN 'resgatado'
         WHEN ${p}expira_em < now() THEN 'expirado'
         ELSE 'disponivel' END AS status,
    ${p}expira_em, ${p}resgatado_por, ${p}resgatado_em, ${p}revogado_em
  `;
};

// "Quantidade usada" não é um campo do token: o consumo não guarda qual token o financiou
// (consumirSaldo insere sem token_id). O que fecha com o extrato é a ordem de entrada —
// créditos são gastos FIFO. Um consumo pertence ao resgate `g` quando, no momento dele, os
// créditos já gastos caem na faixa que `g` abriu: (acumulado antes de g, acumulado até g].
const CTE_CONSUMOS = `
  WITH creditos AS (
    SELECT conta_id, token_id, quantidade,
      SUM(quantidade) OVER (PARTITION BY conta_id ORDER BY criado_em, id) AS acumulado
    FROM movimentos_saldo WHERE tipo IN ('registro','resgate')
  ),
  gastos AS (
    SELECT conta_id, id,
      ROW_NUMBER() OVER (PARTITION BY conta_id ORDER BY criado_em, id) AS numero
    FROM movimentos_saldo WHERE tipo = 'consumo'
  )
`;

// Alfabeto sem caracteres ambíguos (0/O, 1/I) para a pessoa conseguir digitar o código.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Ruling SS: o código do token é o único controle de acesso de um resgate de valor real,
// então vem de um CSPRNG, não de Math.random(). O alfabeto tem 32 caracteres, e 256 é
// múltiplo de 32, então `b % 32` é exatamente uniforme, sem viés. Sem retry de colisão:
// o espaço é 32^8 (1 em um trilhão) e um caminho de retry não seria testável.
export function codigoDeToken(planoCodigo: string): string {
  const bytes = randomBytes(8);
  const parte = (base: number): string =>
    Array.from({ length: 4 }, (_, i) => ALFABETO[bytes[base + i] % ALFABETO.length]).join('');
  return `${planoCodigo.toUpperCase()}-${parte(0)}-${parte(4)}`;
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
// resgatou e o quanto ele usou daquele resgate. O join fica no repositório, não na rota.
export async function listarTokensComEmail(): Promise<TokenAdminView[]> {
  const { rows } = await getPool().query(
    `${CTE_CONSUMOS}
     SELECT ${colunas('t')}, c.email AS resgatado_por_email, COALESCE(COUNT(s.id), 0)::int AS usados
     FROM tokens t
     LEFT JOIN contas c ON c.id = t.resgatado_por
     LEFT JOIN creditos g ON g.token_id = t.id
     LEFT JOIN gastos s ON s.conta_id = g.conta_id
       AND g.acumulado - g.quantidade < s.numero AND s.numero <= g.acumulado
     GROUP BY t.id, c.email
     ORDER BY t.criado_em DESC`
  );
  return rows as TokenAdminView[];
}

// A mesma atribuição FIFO, para um token só, dentro da transação da revogação. A conta não
// entra no filtro: quem resolve a conta é o próprio join (s.conta_id = g.conta_id).
async function usadosDoToken(client: PoolClient, tokenId: string): Promise<number> {
  const { rows } = await client.query(
    `${CTE_CONSUMOS}
     SELECT COUNT(s.id)::int AS usados
     FROM creditos g JOIN gastos s ON s.conta_id = g.conta_id
       AND g.acumulado - g.quantidade < s.numero AND s.numero <= g.acumulado
     WHERE g.token_id = $1`,
    [tokenId],
  );
  return rows[0].usados as number;
}

// Ruling (nova): um código já resgatado só pode ser revogado se o aluno usou no máximo
// LIMITE_DE_USO_PARA_REVOGAR créditos daquele resgate. O que foi usado não volta — a revisão
// já foi gerada; o que sobra volta para o saldo e fica registrado como estorno no extrato.
export const LIMITE_DE_USO_PARA_REVOGAR = 2;

// `usados` acompanha o motivo `limite_de_uso`: é o número que a mensagem da rota mostra.
export type RevogacaoResultado =
  | { ok: true; usados: number; estornado: number; novoSaldo: number }
  | { ok: false; motivo: 'nao_encontrado' | 'nao_resgatado' | 'ja_revogado' }
  | { ok: false; motivo: 'limite_de_uso'; usados: number };

export async function revogarToken(tokenId: string): Promise<RevogacaoResultado> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const token = await client.query(
      'SELECT id, resgatado_por, revogado_em FROM tokens WHERE id = $1 FOR UPDATE',
      [tokenId],
    );
    const t = token.rows[0];
    if (!t) { await client.query('ROLLBACK'); return { ok: false, motivo: 'nao_encontrado' }; }
    if (!t.resgatado_por) { await client.query('ROLLBACK'); return { ok: false, motivo: 'nao_resgatado' }; }
    if (t.revogado_em) { await client.query('ROLLBACK'); return { ok: false, motivo: 'ja_revogado' }; }

    const usados = await usadosDoToken(client, tokenId);
    if (usados > LIMITE_DE_USO_PARA_REVOGAR) {
      await client.query('ROLLBACK');
      return { ok: false, motivo: 'limite_de_uso', usados };
    }

    // O que o resgate de fato concedeu é o movimento, não planos.revisoes: se o plano mudar
    // depois, o valor histórico do extrato é o que está certo de estornar.
    const credito = await client.query(
      `SELECT quantidade FROM movimentos_saldo WHERE tipo = 'resgate' AND token_id = $1`,
      [tokenId],
    );
    const estornado = (credito.rows[0].quantidade as number) - usados;

    // O UPDATE já trava a linha: FOR UPDATE aqui seria sintaxe inválida em Postgres.
    await client.query(
      'UPDATE contas SET saldo_revisoes = saldo_revisoes - $1 WHERE id = $2',
      [estornado, t.resgatado_por],
    );
    // Estorno de 0 não entra no extrato: nada mudou no saldo e uma linha de quantidade zero
    // não comunica nada. A revogação em si fica em tokens.revogado_em.
    if (estornado > 0) {
      await client.query(
        `INSERT INTO movimentos_saldo (conta_id, tipo, quantidade, token_id) VALUES ($1, 'revogacao', $2, $3)`,
        [t.resgatado_por, -estornado, tokenId],
      );
    }
    await client.query('UPDATE tokens SET revogado_em = now() WHERE id = $1', [tokenId]);
    const conta = await client.query('SELECT saldo_revisoes FROM contas WHERE id = $1', [t.resgatado_por]);
    await client.query('COMMIT');
    return { ok: true, usados, estornado, novoSaldo: conta.rows[0].saldo_revisoes as number };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export type ExclusaoResultado = { ok: true } | { ok: false; motivo: 'nao_encontrado' | 'ja_usado' };

// Só código que nunca foi resgatado: um resgate já mexeu no saldo de alguém e o movimento do
// extrato aponta para o token — apagá-lo apagaria a referência que explica aquele lançamento.
export async function excluirToken(tokenId: string): Promise<ExclusaoResultado> {
  const pool = getPool();
  const { rows } = await pool.query(
    'DELETE FROM tokens WHERE id = $1 AND resgatado_por IS NULL RETURNING id',
    [tokenId],
  );
  if (rows.length) return { ok: true };
  const existe = await pool.query('SELECT 1 FROM tokens WHERE id = $1', [tokenId]);
  return existe.rowCount ? { ok: false, motivo: 'ja_usado' } : { ok: false, motivo: 'nao_encontrado' };
}
