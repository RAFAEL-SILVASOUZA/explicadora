import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado, naoAdministrador } from '@/lib/auth/guard';
import { gerarLote, listarTokensComEmail } from '@/lib/repos/tokens';

const EXPIRACAO_PADRAO_DIAS = 30;
const PLANOS = ['free', 'pro', 'familia'];

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (auth.role !== 'admin') return naoAdministrador();

  // O SQL do join fica no repositório (`listarTokensComEmail`) e o CASE do status continua
  // em um lugar só, em `colunas()`.
  return NextResponse.json(await listarTokensComEmail());
}

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (auth.role !== 'admin') return naoAdministrador();

  const body = await req.json().catch(() => ({}));
  const planoCodigo = String(body.plano_codigo ?? '').trim().toLowerCase();
  const quantidade = Number(body.quantidade);
  const dias = Number(body.expira_em_dias) || EXPIRACAO_PADRAO_DIAS;

  if (!PLANOS.includes(planoCodigo)) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) {
    return NextResponse.json({ error: 'Quantidade entre 1 e 100.' }, { status: 400 });
  }

  const expiraEm = new Date(Date.now() + dias * 86400000);
  const tokens = await gerarLote(auth.contaId, planoCodigo, quantidade, expiraEm);
  return NextResponse.json({ lote: tokens.length, tokens }, { status: 201 });
}
