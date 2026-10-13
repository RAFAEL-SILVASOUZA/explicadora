import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado, naoAdministrador } from '@/lib/auth/guard';
import {
  excluirToken, revogarToken, LIMITE_DE_USO_PARA_REVOGAR,
} from '@/lib/repos/tokens';

// POST: revoga um código já resgatado, quando o aluno usou no máximo o limite de créditos
// daquele resgate. O que ele usou não volta; o que sobra vira estorno no extrato.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (auth.role !== 'admin') return naoAdministrador();

  const resultado = await revogarToken(params.id);
  if (resultado.ok) return NextResponse.json(resultado);

  if (resultado.motivo === 'limite_de_uso') {
    return NextResponse.json(
      { error: `Esse código já teve ${resultado.usados} revisões usadas. Só dá para revogar com até ${LIMITE_DE_USO_PARA_REVOGAR}.` },
      { status: 409 },
    );
  }
  const motivos = {
    nao_encontrado: { status: 404, error: 'Esse código não existe mais.' },
    nao_resgatado: { status: 409, error: 'Esse código ainda não foi resgatado: não há o que revogar.' },
    ja_revogado: { status: 409, error: 'Esse código já foi revogado.' },
  };
  const motivo = motivos[resultado.motivo];
  return NextResponse.json({ error: motivo.error }, { status: motivo.status });
}

// DELETE: remove um código que ainda não foi usado. Um código usado não sai da tabela porque
// o extrato da conta aponta para ele.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();
  if (auth.role !== 'admin') return naoAdministrador();

  const resultado = await excluirToken(params.id);
  if (resultado.ok) return NextResponse.json({ ok: true });

  const motivos = {
    nao_encontrado: 'Esse código não existe mais.',
    ja_usado: 'Esse código já foi usado e não pode ser excluído.',
  };
  return NextResponse.json(
    { error: motivos[resultado.motivo] },
    { status: resultado.motivo === 'nao_encontrado' ? 404 : 409 },
  );
}
