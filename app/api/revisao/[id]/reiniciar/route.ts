import { NextRequest, NextResponse } from 'next/server';
import { getSessao, limparRespostas } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessao = getSessao(params.id);
    if (!sessao) {
      return NextResponse.json({ error: 'Essa revisão não existe mais.' }, { status: 404 });
    }

    limparRespostas(params.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[POST /api/revisao/[id]/reiniciar] falha:', err);
    return NextResponse.json({ error: 'Não consegui reiniciar. Tente novamente.' }, { status: 500 });
  }
}
