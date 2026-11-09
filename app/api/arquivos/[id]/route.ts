import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { getPool } from '@/lib/db/pool';
import { getArquivoPorId, removerArquivo, renomearArquivo } from '@/lib/repos/arquivos';
import { apagarBytesDoArquivo, ehUuid } from '@/lib/uploads/biblioteca';
import { dividirNomeExibicao, ehRaizNomeValida, montarNomeExibicao } from '@/lib/uploads/nomeSeguro';
import { MAX_CARACTERES_NOME_ARQUIVO } from '@/lib/constantes';
import { paraArquivoPublico } from '@/lib/uploads/publico';

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

// Renomear um item da biblioteca. Só o radical muda ('prova-logica' em
// 'prova-logica.png'): a extensão é lida da linha atual, nunca aceita do cliente —
// mudar a extensão mentiria sobre o mime, que o servidor detecta pelo conteúdo.
// Os bytes no object storage não são tocados: a chave do objeto é o id.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (!ehUuid(params.id)) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'Envie o novo nome em JSON.' }, { status: 400 });
  }
  const raiz = typeof corpo === 'object' && corpo !== null && typeof (corpo as { nome?: unknown }).nome === 'string'
    ? (corpo as { nome: string }).nome.trim()
    : '';
  if (!ehRaizNomeValida(raiz)) {
    return NextResponse.json(
      { error: `Nome inválido: use de 1 a ${MAX_CARACTERES_NOME_ARQUIVO} caracteres (letras, números, hífen ou sublinhado), sem espaços.` },
      { status: 400 },
    );
  }

  // A posse é validada no SELECT antes do UPDATE; o UPDATE repete a guarda no WHERE.
  const atual = await getArquivoPorId(getPool(), params.id, auth.contaId);
  if (!atual) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });

  const { extensao } = dividirNomeExibicao(atual.nome);
  const atualizado = await renomearArquivo(getPool(), params.id, auth.contaId, montarNomeExibicao(raiz, extensao));
  // null aqui é corrida: o arquivo foi removido entre o SELECT e o UPDATE.
  if (!atualizado) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });

  return NextResponse.json(paraArquivoPublico(atualizado));
}
