import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { resgateToken } from '@/lib/repos/tokens';

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const body = await req.json().catch(() => ({}));
  const codigo = String(body.codigo ?? '').trim().toUpperCase();
  if (!codigo) return NextResponse.json({ error: 'Cole o código do token.' }, { status: 400 });

  const resultado = await resgateToken(codigo, auth.contaId);
  // Ruling AA: o contrato da rota é `200 { plano, revisoes, novoSaldo }`. O `ok` é
  // um sinal interno do repositório e não entra na resposta.
  if (resultado.ok) {
    return NextResponse.json({
      plano: resultado.plano,
      revisoes: resultado.revisoes,
      novoSaldo: resultado.novoSaldo,
    });
  }

  const status = { nao_encontrado: 404, ja_resgatado: 409, expirado: 410 }[resultado.motivo];
  const mensagens = {
    nao_encontrado: 'Esse código não existe.',
    ja_resgatado: 'Esse token já foi usado.',
    expirado: 'Esse token expirou. Peça um novo.',
  };
  return NextResponse.json({ error: mensagens[resultado.motivo] }, { status });
}
