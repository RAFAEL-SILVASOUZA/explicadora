import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { buscarOrder, criarOrder } from '../../lib/mercadopago';

beforeEach(() => {
  process.env.MP_ACCESS_TOKEN = 'TEST-fake-token-12345';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('criarOrder envia payload correto para a API de Orders do MP', async () => {
  let urlChamada = '';
  let optionsChamada: RequestInit | undefined;

  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    urlChamada = url;
    optionsChamada = options;
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 'order-123',
        status: 'created',
        checkout_url: 'https://mercadopago.com/checkout/order-123',
        external_reference: 'pedido-uuid-abc',
      }),
    } as Response;
  });

  const res = await criarOrder({
    plano: { codigo: 'pro', nome: 'Pro', revisoes: 20, preco_cents: 1500 },
    pedidoId: 'pedido-uuid-abc',
  });

  expect(urlChamada).toBe('https://api.mercadopago.com/v1/orders');
  expect(optionsChamada?.method).toBe('POST');

  const headers = optionsChamada?.headers as Record<string, string>;
  expect(headers['Authorization']).toBe('Bearer TEST-fake-token-12345');
  expect(headers['Content-Type']).toBe('application/json');

  const body = JSON.parse(String(optionsChamada?.body));
  expect(body.type).toBe('online');
  expect(body.external_reference).toBe('pedido-uuid-abc');
  expect(body.items[0]).toEqual({
    title: 'Plano Pro — 20 revisões',
    quantity: 1,
    unit_price: 15,
    currency_id: 'BRL',
  });
  expect(body.back_urls.success).toBe('https://app.test/creditos?status=approved');
  expect(body.notification_url).toBe('https://app.test/api/pagamentos/webhook');

  expect(res.id).toBe('order-123');
  expect(res.checkout_url).toBe('https://mercadopago.com/checkout/order-123');
});

test('buscarOrder faz requisição GET para o endpoint com ID correto', async () => {
  let urlChamada = '';
  let optionsChamada: RequestInit | undefined;

  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    urlChamada = url;
    optionsChamada = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'order-999',
        status: 'processed',
        external_reference: 'pedido-xyz',
      }),
    } as Response;
  });

  const order = await buscarOrder('order-999');
  expect(urlChamada).toBe('https://api.mercadopago.com/v1/orders/order-999');
  expect((optionsChamada?.headers as Record<string, string>)['Authorization']).toBe(
    'Bearer TEST-fake-token-12345',
  );
  expect(order.status).toBe('processed');
});
