// lib/mercadopago.ts
// Wrapper fino sobre a Orders API do Mercado Pago.
// Mantém todo o HTTP aqui para facilitar mocks em testes e troca de ambiente.

const BASE = 'https://api.mercadopago.com';

function headers() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN não configurado');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface ItemOrder {
  title: string;
  quantity: number;
  unit_price: number;  // em reais (float), não cents
  currency_id: string;
}

export interface CriarOrderInput {
  plano: { codigo: string; nome: string; revisoes: number; preco_cents: number };
  pedidoId: string; // UUID gerado localmente → external_reference para rastreio
}

export interface MpOrder {
  id: string;
  status: string;
  external_reference: string;
  checkout_url: string;
}

export async function criarOrder(input: CriarOrderInput): Promise<MpOrder> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const body = {
    type: 'online',
    external_reference: input.pedidoId,
    items: [
      {
        title: `Plano ${input.plano.nome} — ${input.plano.revisoes} revisões`,
        quantity: 1,
        unit_price: input.plano.preco_cents / 100,
        currency_id: 'BRL',
      },
    ],
    payer: { entity_type: 'individual' },
    payment: {
      installments: { default_installments: 1 },
    },
    back_urls: {
      success: `${appUrl}/creditos?status=approved`,
      failure: `${appUrl}/creditos?status=failed`,
      pending: `${appUrl}/creditos?status=pending`,
    },
    notification_url: `${appUrl}/api/pagamentos/webhook`,
  };

  const res = await fetch(`${BASE}/v1/orders`, {
    method: 'POST',
    headers: headers(),
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
