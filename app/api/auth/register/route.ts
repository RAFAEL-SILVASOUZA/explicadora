import { NextRequest, NextResponse } from 'next/server';
import { contaPublica, createConta } from '@/lib/repos/contas';
import { registrarMovimento } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { hashSenha } from '@/lib/auth/senha';
import { assinarToken } from '@/lib/auth/jwt';
import { SALDO_INICIAL } from '@/lib/quota';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const nome = String(body.nome ?? '').trim();
  const sobrenome = String(body.sobrenome ?? '').trim();
  const email = String(body.email ?? '').toLowerCase().trim();
  const senha = String(body.senha ?? '');
  if (!nome || !sobrenome || !email || !senha) {
    return NextResponse.json({ error: 'Preencha nome, sobrenome, email e senha.' }, { status: 400 });
  }
  // As confirmações são conferidas também no servidor: a UI valida por UX, mas a
  // rota não confia só nela.
  if (String(body.email_confirmacao ?? '').toLowerCase().trim() !== email) {
    return NextResponse.json({ error: 'A confirmação de email não casa com o email.' }, { status: 400 });
  }
  if (String(body.senha_confirmacao ?? '') !== senha) {
    return NextResponse.json({ error: 'A confirmação de senha não casa com a senha.' }, { status: 400 });
  }

  try {
    const conta = await comTransacao(async (client) => {
      const novaConta = await createConta(nome, sobrenome, email, await hashSenha(senha), SALDO_INICIAL, client);
      await registrarMovimento(client, novaConta.id, 'registro', SALDO_INICIAL);
      return novaConta;
    });
    return NextResponse.json({ token: assinarToken(conta.id, conta.role), conta: contaPublica(conta) }, { status: 201 });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Esse email já está cadastrado.' }, { status: 409 });
    }
    console.error('[POST /api/auth/register] falha:', err);
    return NextResponse.json({ error: 'Algo deu errado. Tente novamente.' }, { status: 500 });
  }
}
