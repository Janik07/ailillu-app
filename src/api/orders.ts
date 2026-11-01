import { cartTotal, type Cart, type Order } from '../store/app';

/**
 * DEMO BOUNDARY. Nothing here reaches ailillu.kz: a real order would go to a
 * venue's kitchen, and SMS and Kaspi are live services. When the team has a test
 * venue or staging server, this is the one function to replace.
 */
export async function submitOrder(cart: Cart, paid: boolean, nextNo: number): Promise<Order> {
  return {
    no: nextNo,
    slug: cart.slug,
    title: cart.title,
    table: cart.mode === 'table' ? cart.table : null,
    paid,
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    lines: cart.lines,
    total: cartTotal(cart.lines),
  };
}
