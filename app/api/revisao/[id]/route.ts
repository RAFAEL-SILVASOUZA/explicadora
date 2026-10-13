import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisaoCompleta, getResultadoCacheado } from '@/lib/repos/revisoes';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  const data = await getRevisaoCompleta(params.id, auth.contaId);
  if (!data) return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
  // `resultado` é o veredito já guardado, quando existe: a página de detalhe mostra o
  // resultado final sem chamar a LLM de novo.
  return NextResponse.json({ ...data, resultado: await getResultadoCacheado(params.id, auth.contaId) });
}
