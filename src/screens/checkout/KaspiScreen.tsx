import { useEffect, useState } from 'react';
import { money } from '../../domain/format';
import { useNav } from '../../nav/stack';
import { cartTotal, useApp } from '../../store/app';
import { Header } from '../../ui/parts';
import { useCheckout } from './useCheckout';
import './checkout.css';

export function KaspiScreen() {
  const nav = useNav();
  const cart = useApp((s) => s.cart);
  const { finish } = useCheckout();
  const [left, setLeft] = useState(300);

  useEffect(() => {
    const timer = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!cart) return null;

  return (
    <div className="screen pushed">
      <Header title="Оплата" sub={cart.title} onBack={nav.pop} />
      <div className="pad kaspi-body">
        <span className="kaspi kaspi-big">K</span>
        <div className="muted kaspi-label">К оплате</div>
        <div className="price kaspi-sum">{money(cartTotal(cart.lines))}</div>
        <div className="row kaspi-wait">
          <span className="kaspi-dot" />
          Ждём подтверждение от Kaspi · {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </div>
        <p className="muted kaspi-text">Оплатите в приложении Kaspi и вернитесь, заказ уйдёт на кухню сам.</p>
      </div>
      <div className="pad kaspi-actions">
        <button className="btn kaspi-pay" onClick={() => void finish(true)}>
          Демо: считать оплаченным
        </button>
        <button className="btn link" onClick={nav.pop}>
          Отменить
        </button>
      </div>
    </div>
  );
}
