import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado, naoAdministrador } from '@/lib/auth/guard';
import { gerarLote, listarTokensComEmail, planoExiste } from '@/lib/repos/tokens';

const EXPIRACAO_PADRAO_DIAS = 30;

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

  const body = (await req.json().catch(() => ({}))) ?? {};
  const planoCodigo = String(body.plano_codigo ?? '').trim().toLowerCase();
  const quantidade = Number(body.quantidade);
  const dias = body.expira_em_dias === undefined ? EXPIRACAO_PADRAO_DIAS : Number(body.expira_em_dias);

  // Ruling GG: `planos` é tabela de referência, não enum no código (spec linha 76).
  if (!(await planoExiste(planoCodigo))) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }
  // O Free não gera códigos: ele é a concessão do cadastro, não um pacote que alguém entrega.
  // Um lote de 'free' criaria códigos que não correspondem a nada vendido.
  if (planoCodigo === 'free') {
    return NextResponse.json({ error: 'O plano Free não gera códigos.' }, { status: 400 });
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) {
    return NextResponse.json({ error: 'Quantidade entre 1 e 100.' }, { status: 400 });
  }
  // Ruling HH: `expira_em_dias` entra na restrição global de 400 para input inválido.
  // Sem isto, 0/'abc' viram o default silencioso e um valor negativo gera tokens já
  // expirados, sem erro.
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
    return NextResponse.json({ error: 'Expiração entre 1 e 365 dias.' }, { status: 400 });
  }

  const expiraEm = new Date(Date.now() + dias * 86400000);
  const tokens = await gerarLote(auth.contaId, planoCodigo, quantidade, expiraEm);
  return NextResponse.json({ lote: tokens.length, tokens }, { status: 201 });
}
