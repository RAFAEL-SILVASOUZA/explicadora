import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { listarRevisoesComResumo } from '@/lib/repos/revisoes';
import { listarDeveresComResumo } from '@/lib/repos/deveres';
import { calcularResumo } from '@/lib/resumo';

// O placar da home: um único JSON com os totais da conta, nunca as listas em bruto.
// As listagens (listarRevisoesComResumo/listarDeveresComResumo) só servem ao servidor:
// o conteúdo de cada revisão/dever não viaja ao cliente, e a fórmula do placar mora na
// função pura calcularResumo — a UI recebe um número já calculado, não os dados brutos.
export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const [revisoes, deveres] = await Promise.all([
    listarRevisoesComResumo(auth.contaId),
    listarDeveresComResumo(auth.contaId),
  ]);

  return NextResponse.json(calcularResumo(revisoes, deveres));
}
