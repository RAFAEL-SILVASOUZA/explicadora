import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getDever, getPassos } from '@/lib/repos/deveres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const dever = await getDever(params.id, auth.contaId);
  if (!dever) return NextResponse.json({ error: 'Dever não encontrado.' }, { status: 404 });

  return NextResponse.json({ dever, passos: await getPassos(params.id) });
}
