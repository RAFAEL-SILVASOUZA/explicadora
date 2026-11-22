import { buscarOrder } from '../lib/mercadopago';
import { buscarPedidoPorMpOrder, aprovarPedido } from '../lib/repos/pedidos';
import { registrarMovimento } from '../lib/repos/movimentos';
import { comTransacao } from '../lib/repos/transacao';

async function run() {
  const orderId = 'ORDTST01M81NR8W0YGHQ0A8KCH0M8Y5M';
  const order = await buscarOrder(orderId);
  console.log('Order status:', order.status);

  if (order.status !== 'processed') {
    console.log('Order ainda não processada.');
    return;
  }

  const pedido = await buscarPedidoPorMpOrder(order.id);
  if (!pedido) {
    console.log('Pedido não encontrado no banco.');
    return;
  }

  if (pedido.status !== 'pending') {
    console.log('Pedido já estava aprovado:', pedido.status);
    return;
  }

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

  console.log(`Sucesso! Creditadas ${pedido.revisoes} revisões para a conta ${pedido.conta_id}`);
}

run().catch(console.error).finally(() => process.exit(0));
