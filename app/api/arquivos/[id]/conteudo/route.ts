import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getPool } from '@/lib/db/pool';
import { getArquivoPorId } from '@/lib/repos/arquivos';
import { ehUuid, lerBytesDoArquivo } from '@/lib/uploads/biblioteca';

// Os bytes da biblioteca, para a miniatura e a pré-visualização na página /arquivos.
// Mora atrás de rota autenticada pelo mesmo motivo do áudio do dever: uploads/ está
// fora de public/ porque public/ é servido sem autenticação.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (!ehUuid(params.id)) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });

  // A posse é validada no SELECT antes de qualquer leitura de disco.
  const arquivo = await getArquivoPorId(getPool(), params.id, auth.contaId);
  if (!arquivo) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });

  try {
    const buffer = await lerBytesDoArquivo(arquivo);
    return new NextResponse(new Uint8Array(buffer), {
      // Vary: Authorization porque a resposta depende da posse validada no token: sem
      // ele, um cache compartilhado pode servir o arquivo de uma conta a outra que
      // conheça a mesma URL.
      headers: {
        'content-type': arquivo.mime,
        'cache-control': 'private, max-age=3600',
        vary: 'Authorization',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 });
  }
}
