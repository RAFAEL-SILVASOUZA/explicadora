import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';
import { contaPublica, createConta, findContaByEmail } from '@/lib/repos/contas';
import { registrarMovimento } from '@/lib/repos/movimentos';
import { hashSenha } from '@/lib/auth/senha';
import { assinarToken } from '@/lib/auth/jwt';
import { SALDO_INICIAL } from '@/lib/quota';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').toLowerCase().trim();
  const senha = String(body.senha ?? '');
  if (!email || !senha) {
    return NextResponse.json({ error: 'Preencha email e senha.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const conta = await createConta(email, await hashSenha(senha), SALDO_INICIAL, client);
    await registrarMovimento(client, conta.id, 'registro', SALDO_INICIAL);
    await client.query('COMMIT');
    return NextResponse.json({ token: assinarToken(conta.id, conta.role), conta: contaPublica(conta) }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Esse email já está cadastrado.' }, { status: 409 });
    }
    console.error('[POST /api/auth/register] falha:', err);
    return NextResponse.json({ error: 'Algo deu errado. Tente novamente.' }, { status: 500 });
  } finally {
    client.release();
  }
}
