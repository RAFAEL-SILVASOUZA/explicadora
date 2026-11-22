// lib/mercadopago.ts
// Wrapper fino sobre a Orders API do Mercado Pago (Checkout Pro via Orders).
const BASE = 'https://api.mercadopago.com';

function headers(idempotencyKey?: string) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN não configurado');
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (idempotencyKey) {
    h['X-Idempotency-Key'] = idempotencyKey;
  }
  return h;
}

export interface CriarOrderInput {
  plano: { codigo: string; nome: string; revisoes: number; preco_cents: number };
  pedidoId: string; // UUID gerado localmente → external_reference e X-Idempotency-Key
  compradorEmail?: string;
}

export interface MpOrder {
  id: string;
  status: string;
  external_reference: string;
  checkout_url: string;
}

export async function criarOrder(input: CriarOrderInput): Promise<MpOrder> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const amountStr = (input.plano.preco_cents / 100).toFixed(2);

  const body = {
    type: 'online',
    processing_mode: 'manual',
    total_amount: amountStr,
    external_reference: input.pedidoId,
    payer: {
      email: input.compradorEmail || 'contato@explicadora.com',
    },
    items: [
      {
        title: `Plano ${input.plano.nome} — ${input.plano.revisoes} revisões`,
        quantity: 1,
        unit_price: amountStr,
      },
    ],
    config: {
      online: {
        success_url: `${appUrl}/creditos?status=approved`,
        failure_url: `${appUrl}/creditos?status=failed`,
        pending_url: `${appUrl}/creditos?status=pending`,
        auto_return: 'approved',
      },
    },
  };

  const res = await fetch(`${BASE}/v1/orders`, {
    method: 'POST',
    headers: headers(input.pedidoId),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`MP criar order: ${res.status} ${JSON.stringify(err)}`);
  }

  return res.json() as Promise<MpOrder>;
}

export async function buscarOrder(orderId: string): Promise<MpOrder> {
  const res = await fetch(`${BASE}/v1/orders/${orderId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`MP buscar order: ${res.status}`);
  return res.json() as Promise<MpOrder>;
}
