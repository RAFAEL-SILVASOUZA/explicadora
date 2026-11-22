// app/api/pagamentos/webhook/route.ts
// Recebe notificações do Mercado Pago, verifica o estado real da order na API
// e credita o saldo do usuário de forma idempotente.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { buscarOrder } from '@/lib/mercadopago';
import { buscarPedidoPorMpOrder, aprovarPedido } from '@/lib/repos/pedidos';
import { registrarMovimento } from '@/lib/repos/movimentos';
import { comTransacao } from '@/lib/repos/transacao';
import { getPool } from '@/lib/db/pool';

// Verifica a assinatura HMAC enviada pelo MP no header x-signature.
// Formato do header: "ts=<timestamp>,v1=<hash>"
function assinaturaValida(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    // Em desenvolvimento (sem secret configurado) aceita sem verificar.
    console.warn('[webhook] MP_WEBHOOK_SECRET não definido — assinatura ignorada');
    return true;
  }

  const sigHeader = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  const dataId = new URL(req.url).searchParams.get('data.id') ?? '';

  // Extrai ts e v1 do header
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
  const ts = parts['ts'] ?? '';
  const v1 = parts['v1'] ?? '';
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!assinaturaValida(req, rawBody)) {
    console.warn('[webhook] assinatura inválida');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  // O MP pode enviar { type: 'payment', data: { id } } ou { type: 'order', data: { id } }
  const tipo = parsed?.type as string | undefined;
  const orderId = (parsed?.data as Record<string, unknown>)?.id as string | undefined;

  // Apenas processar notificações de order/payment com ID
  if (!orderId || !['order', 'payment', 'orders_v2'].includes(tipo ?? '')) {
    return NextResponse.json({ ok: true }); // notificação ignorada
  }

  // Busca o estado real da order no MP — NUNCA confiar apenas no body do webhook
  let order: Awaited<ReturnType<typeof buscarOrder>>;
  try {
    order = await buscarOrder(orderId);
  } catch (err) {
    console.error('[webhook] erro ao buscar order no MP:', err);
    // Retorna 200 para o MP não reenviar; logar para investigação
    return NextResponse.json({ ok: true });
  }

  // Só processa quando o MP confirma que o pagamento foi processado
  if (order.status !== 'processed') {
    return NextResponse.json({ ok: true });
  }

  const pedido = await buscarPedidoPorMpOrder(order.id);
  if (!pedido) {
    console.warn('[webhook] order não encontrada no banco:', order.id);
    return NextResponse.json({ ok: true });
  }

  // Idempotência: se já foi aprovado antes, ignora silenciosamente
  if (pedido.status !== 'pending') {
    return NextResponse.json({ ok: true });
  }

  await comTransacao(async (client) => {
    // Creditar saldo
    await client.query(
      'UPDATE contas SET saldo_revisoes = saldo_revisoes + $1 WHERE id = $2',
      [pedido.revisoes, pedido.conta_id],
    );

    // Registrar movimento de resgate vinculado ao pedido
    await registrarMovimento(client, pedido.conta_id, 'resgate', pedido.revisoes, {
      pedido_id: pedido.id,
    });

    // Marcar pedido como aprovado (UPDATE com WHERE status='pending' → idempotência extra)
    await aprovarPedido(client, pedido.id);
  });

  console.info(`[webhook] saldo creditado: conta=${pedido.conta_id} revisoes=${pedido.revisoes}`);
  return NextResponse.json({ ok: true });
}
