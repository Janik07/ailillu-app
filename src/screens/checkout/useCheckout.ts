import { useCallback } from 'react';
import { submitOrder } from '../../api/orders';
import { useNav } from '../../nav/stack';
import { useApp } from '../../store/app';

const FIRST_ORDER_NO = 214;

export function useCheckout() {
  const nav = useNav();

  /** Places the order and clears the way back, so Back cannot return to a paid basket. */
  const finish = useCallback(
    async (paid: boolean) => {
      const { cart, orders, addOrder } = useApp.getState();
      if (!cart) return;
      const order = await submitOrder(cart, paid, FIRST_ORDER_NO + orders.length);
      nav.reset([{ type: 'status', no: order.no }]);
      addOrder(order);
    },
    [nav],
  );

  return { finish };
}
