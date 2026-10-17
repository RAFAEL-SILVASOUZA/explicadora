import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getDever, getPassos } from '@/lib/repos/deveres';

// O áudio fica fora de public/ justamente para passar por aqui: sem esta rota,
// qualquer pessoa com a URL leria a explicação de outra criança.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; ordem: string } },
) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const dever = await getDever(params.id, auth.contaId);
  if (!dever) return NextResponse.json({ error: 'Dever não encontrado.' }, { status: 404 });

  const ordem = Number(params.ordem);
  if (!Number.isInteger(ordem) || ordem < 1) {
    return NextResponse.json({ error: 'Passo inválido.' }, { status: 404 });
  }

  const passo = (await getPassos(params.id)).find((p) => p.ordem === ordem);
  if (!passo?.audio_path) return NextResponse.json({ error: 'Áudio indisponível.' }, { status: 404 });

  try {
    const buffer = await fs.readFile(path.join(process.cwd(), passo.audio_path));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { 'content-type': 'audio/wav', 'cache-control': 'private, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'Áudio indisponível.' }, { status: 404 });
  }
}
