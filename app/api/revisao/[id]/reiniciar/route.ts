import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getRevisao, limparRespostas } from '@/lib/repos/revisoes';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  try {
    if (!(await getRevisao(params.id, auth.contaId))) {
      return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
    }
    await limparRespostas(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/revisao/[id]/reiniciar] falha:', err);
    return NextResponse.json({ error: 'Não consegui reiniciar. Tente novamente.' }, { status: 500 });
  }
}
