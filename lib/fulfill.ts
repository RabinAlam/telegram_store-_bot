import { store } from './store';

// Single shared fulfill path for Stars / crypto / Binance webhooks + manual admin fulfill.
// Idempotent: only PENDING/CONFIRMED/NEEDS_REVIEW orders are processed; DELIVERED returns as-is.
// Takes one vault row per qty unit. Empty vault -> NEEDS_REVIEW (manual delivery).
export async function fulfillOrder(orderId: string): Promise<{ status: string; deliveries?: Array<{ login: string; password: string }> }> {
  const order = store.getOrder(orderId);
  if (!order) throw new Error('unknown order');
  if (order.status === 'DELIVERED') return { status: 'DELIVERED', deliveries: order.deliveries ?? [] };
  if (order.status !== 'PENDING' && order.status !== 'CONFIRMED' && order.status !== 'NEEDS_REVIEW') {
    return { status: order.status };
  }
  const hasVault = store.vaultHas(order.productId);
  if (hasVault) {
    const taken = store.vaultTake(order.productId, order.qty, order.id);
    if (!taken) {
      store.setOrderStatus(order.id, 'NEEDS_REVIEW');
      return { status: 'NEEDS_REVIEW' };
    }
    store.setOrderDeliveries(order.id, taken);
    store.setOrderStatus(order.id, 'DELIVERED');
    const it = store.allIntents().find((i) => i.orderId === order.id && (i.status === 'PENDING' || i.status === 'CONFIRMED'));
    if (it) store.setIntent(it.id, { status: 'FULFILLED' });
    return { status: 'DELIVERED', deliveries: taken };
  }
  // Legacy path: products without vault rows keep the placeholder-code behavior.
  const code = `EM-${order.id.slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  store.setOrderStatus(order.id, 'DELIVERED', code);
  const it = store.allIntents().find((i) => i.orderId === order.id && (i.status === 'PENDING' || i.status === 'CONFIRMED'));
  if (it) store.setIntent(it.id, { status: 'FULFILLED' });
  return { status: 'DELIVERED' };
}
