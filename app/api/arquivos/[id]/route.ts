import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getPool } from '@/lib/db/pool';
import { removerArquivo } from '@/lib/repos/arquivos';
import { apagarBytesDoArquivo, ehUuid } from '@/lib/uploads/biblioteca';

// Excluir um item da biblioteca. A posse entra no WHERE do DELETE: id de outra conta
// devolve 404 sem revelar que existe.
//
// Revisões e deveres já criados não mudam: o texto e as imagens daquela criação foram
// processados e persistidos no resultado. A referência por id vale só no momento da
// criação.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (!ehUuid(params.id)) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });

  const removido = await removerArquivo(getPool(), params.id, auth.contaId);
  if (!removido) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });

  // A linha já se foi: se apagar os bytes falhar sobra arquivo sem dono (o script de
  // limpeza cuida disso), nunca uma linha apontando para um arquivo inexistente.
  await apagarBytesDoArquivo(removido).catch(() => {});
  return NextResponse.json({ id: removido.id });
}
