import { buscarOrder } from '../lib/mercadopago';

async function run() {
  const order = await buscarOrder('ORDTST01M81NR8W0YGHQ0A8KCH0M8Y5M');
  console.log('Order no Mercado Pago:', order);
}

run().catch(console.error);
