import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { contaPublica, findContaById } from '@/lib/repos/contas';
import { extratoConta } from '@/lib/repos/movimentos';

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const conta = await findContaById(auth.contaId);
  if (!conta) return naoAutorizado();

  // Rows vêm da mais nova para a mais antiga, então o primeiro `resgate` é o último.
  const movimentos = (await extratoConta(conta.id)).rows;
  const ultimoResgate = movimentos.find(m => m.tipo === 'resgate');

  return NextResponse.json({
    conta: contaPublica(conta),
    plano: ultimoResgate?.plano_codigo ?? 'free',
    saldo: conta.saldo_revisoes,
    movimentos,
  });
}
