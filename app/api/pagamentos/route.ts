// app/api/pagamentos/route.ts
// Cria uma order no Mercado Pago e retorna o checkout_url para o front redirecionar.
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { findContaById } from '@/lib/repos/contas';
import { listarPlanos } from '@/lib/repos/planos';
import { criarPedido } from '@/lib/repos/pedidos';
import { criarOrder } from '@/lib/mercadopago';
import { comTransacao } from '@/lib/repos/transacao';

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const body = await req.json().catch(() => null);
  const planoCodigo: unknown = body?.plano_codigo;
  if (!planoCodigo || typeof planoCodigo !== 'string') {
    return NextResponse.json({ error: 'plano_codigo obrigatório' }, { status: 400 });
  }

  const planos = await listarPlanos();
  const plano = planos.find((p) => p.codigo === planoCodigo);
  if (!plano) {
    return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
  }
  if (plano.preco_cents === 0) {
    return NextResponse.json({ error: 'Plano gratuito não exige pagamento' }, { status: 422 });
  }

  const conta = await findContaById(auth.contaId);
  const pedidoId = randomUUID();

  // 1. Cria a order no Mercado Pago (fora da transação — operação externa)
  let order: Awaited<ReturnType<typeof criarOrder>>;
  try {
    order = await criarOrder({
      plano,
      pedidoId,
      compradorEmail: conta?.email,
    });
  } catch (err) {
    console.error('[pagamentos] erro ao criar order no MP:', err);
    return NextResponse.json({ error: 'Falha ao iniciar pagamento. Tente novamente.' }, { status: 502 });
  }

  // 2. Persiste o pedido localmente (em transação — rollback automático em erro)
  await comTransacao(async (client) => {
    await criarPedido(client, auth.contaId, plano.codigo, order.id, pedidoId);
  });

  return NextResponse.json({ checkout_url: order.checkout_url });
}
