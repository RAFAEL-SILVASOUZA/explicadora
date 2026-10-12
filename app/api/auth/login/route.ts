import { NextRequest, NextResponse } from 'next/server';
import { contaPublica, findContaByEmail } from '@/lib/repos/contas';
import { verificarSenha } from '@/lib/auth/senha';
import { assinarToken } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').toLowerCase().trim();
  const senha = String(body.senha ?? '');
  if (!email || !senha) {
    return NextResponse.json({ error: 'Preencha email e senha.' }, { status: 400 });
  }

  const conta = await findContaByEmail(email);
  // `?? ''`: senha_hash é opcional em Conta (só aparece na leitura interna do
  // repositório) e verificarSenha() devolve false para hash vazio, então o
  // resultado é o mesmo. Sem o ?? o strict mode do tsc reclama.
  if (!conta || !(await verificarSenha(senha, conta.senha_hash ?? ''))) {
    return NextResponse.json({ error: 'Email ou senha incorretos.' }, { status: 401 });
  }
  return NextResponse.json({ token: assinarToken(conta.id, conta.role), conta: contaPublica(conta) });
}
