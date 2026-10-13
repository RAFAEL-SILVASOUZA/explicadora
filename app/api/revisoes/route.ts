import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { listarRevisoesComResumo } from '@/lib/repos/revisoes';

// A grid da área de revisões: cada revisão com o resumo (questões, respostas, acertos).
export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  return NextResponse.json(await listarRevisoesComResumo(auth.contaId));
}
