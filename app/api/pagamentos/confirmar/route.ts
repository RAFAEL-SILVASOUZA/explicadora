import { NextRequest, NextResponse } from 'next/server';
import { autenticar, naoAutorizado } from '@/lib/auth/guard';
import { buscarOrder } from '@/lib/mercadopago';
import { buscarPedidoPorMpOrder, aprovarPedido } from '@/lib/repos/pedidos';
import { registrarMovimento } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';

export async function POST(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return naoAutorizado();

  const body = await req.json().catch(() => ({}));
  const orderId = body?.order_id;
  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: 'order_id obrigatório' }, { status: 400 });
  }

  let order: Awaited<ReturnType<typeof buscarOrder>>;
  try {
    order = await buscarOrder(orderId);
  } catch (err) {
    console.error('[confirmar] erro ao buscar order no MP:', err);
    return NextResponse.json({ error: 'Order não encontrada' }, { status: 404 });
  }

  if (order.status !== 'processed') {
    return NextResponse.json({ creditado: false, status: order.status });
  }

  const pedido = await buscarPedidoPorMpOrder(order.id);
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido local não encontrado' }, { status: 404 });
  }

  // Idempotência: só credita se ainda estiver pending
  if (pedido.status === 'pending') {
    await comTransacao(async (client) => {
      await client.query(
        'UPDATE contas SET saldo_revisoes = saldo_revisoes + $1 WHERE id = $2',
        [pedido.revisoes, pedido.conta_id]
      );

      await registrarMovimento(client, pedido.conta_id, 'resgate', pedido.revisoes, {
        pedido_id: pedido.id,
      });

      await aprovarPedido(client, pedido.id);
    });

    console.info(`[confirmar] saldo creditado com sucesso: conta=${pedido.conta_id} revisoes=${pedido.revisoes}`);
    return NextResponse.json({ creditado: true, revisoes: pedido.revisoes });
  }

  return NextResponse.json({ creditado: true, jaAprovado: true });
}
