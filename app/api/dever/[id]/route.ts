import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getDever, getSlides, atualizarLeitura } from '@/lib/repos/deveres';
import { comTransacao } from '@/lib/repos/transacao';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const dever = await getDever(params.id, auth.contaId);
  if (!dever) return NextResponse.json({ error: 'Dever não encontrado.' }, { status: 404 });

  return NextResponse.json({ dever, slides: await getSlides(params.id) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const dever = await getDever(params.id, auth.contaId);
  if (!dever) return NextResponse.json({ error: 'Dever não encontrado.' }, { status: 404 });

  let corpo: { lido_ate?: number; concluido?: boolean };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
  }

  const lidoAte = typeof corpo.lido_ate === 'number' && Number.isInteger(corpo.lido_ate) && corpo.lido_ate >= 0
    ? corpo.lido_ate
    : dever.lido_ate;
  const concluido = typeof corpo.concluido === 'boolean' ? corpo.concluido : dever.concluido;

  await comTransacao(async (client) => {
    await atualizarLeitura(client, params.id, lidoAte, concluido);
  });

  return NextResponse.json({ ok: true, lido_ate: lidoAte, concluido });
}
