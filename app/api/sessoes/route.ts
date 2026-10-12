import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { listarRevisoes } from '@/lib/repos/revisoes';

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  return NextResponse.json(await listarRevisoes(auth.contaId));
}
