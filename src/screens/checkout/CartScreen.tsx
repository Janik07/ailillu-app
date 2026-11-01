import { useEffect, useState } from 'react';
import { money } from '../../domain/format';
import { useNav } from '../../nav/stack';
import { cartTotal, useApp } from '../../store/app';
import { useMenu } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { Header, KaspiMark, Photo, Stepper } from '../../ui/parts';
import { useCheckout } from './useCheckout';
import './checkout.css';

export function CartScreen({ active }: { active: boolean }) {
  const nav = useNav();
  const cart = useApp((s) => s.cart);
  const phone = useApp((s) => s.phone);
  const setLineQty = useApp((s) => s.setLineQty);
  const setCartMode = useApp((s) => s.setCartMode);
  const clearCart = useApp((s) => s.clearCart);
  const { menu } = useMenu(cart?.slug ?? '');
  const { finish } = useCheckout();
  const [comment, setComment] = useState('');
  const [later, setLater] = useState(true);

  useEffect(() => {
    if (!cart && active) nav.pop();
  }, [cart, active, nav]);

  if (!cart) return null;

  const payments = menu?.payments ?? [];
  const kaspi = payments.includes('kaspi_qr');
  const waiter = payments.includes('cash') || payments.includes('card_to_waiter');
  const onTable = cart.mode === 'table';
  const payNow = kaspi && (!waiter || !later || !onTable);
  const canPay = !!menu && (kaspi || waiter);

  const send = () => {
    if (!phone) nav.push({ type: 'phone', payNow, comment });
    else if (payNow) nav.push({ type: 'kaspi', comment });
    else void finish(false);
  };

  return (
    <div className="screen pushed">
      <Header
        title="Корзина"
        sub={cart.title + (onTable && cart.table ? ` · стол ${cart.table}` : '')}
        onBack={nav.pop}
        right={
          <button className="iconbtn" aria-label="Очистить корзину" onClick={clearCart}>
            <Icon name="trash" />
          </button>
        }
      />
      <div className="scroll pad cart-scroll">
        {menu?.canTakeaway && (
          <>
            <div className="seg">
              <button
                className={onTable ? 'on' : ''}
                onClick={() => (cart.table ? setCartMode('table') : nav.push({ type: 'qr', prefer: cart.slug }))}
              >
                <Icon name="seat" size={17} />
                {cart.table ? `За столом ${cart.table}` : 'За столом'}
              </button>
              <button className={onTable ? '' : 'on'} onClick={() => setCartMode('takeaway')}>
                <Icon name="bag" size={17} />С собой
              </button>
            </div>
            <div className="small muted cart-hint">
              {onTable ? 'Стол взят из QR. Заказ принесут к столу.' : 'Упакуем, заберёте на кассе.'}
            </div>
          </>
        )}

        {cart.lines.map((l, i) => (
          <div key={l.itemId + l.mods} className="list-row">
            {l.image && <Photo base="dalle" path={l.image} className="thumb sm" />}
            <div className="grow">
              <div className="strong">
                {l.name}
                {l.volume && ` · ${l.volume}`}
              </div>
              {l.mods && <div className="small muted">{l.mods}</div>}
              <div className="price cart-price">{money(l.price * l.qty)}</div>
            </div>
            <Stepper qty={l.qty} onChange={(v) => setLineQty(i, v)} />
          </div>
        ))}

        <label className="row cart-comment">
          <span className="muted">
            <Icon name="chat" />
          </span>
          <input
            id="cart-comment"
            placeholder="Комментарий для кухни"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoComplete="off"
          />
        </label>

        <div className="h2 cart-heading">Оплата</div>
        {kaspi && waiter && onTable ? (
          <div className="pay-options">
            <button className={`pay-option${later ? ' on' : ''}`} onClick={() => setLater(true)}>
              <Icon name="waiter" />
              <div className="grow">
                <b>Потом, официанту</b>
                <div className="small muted">Наличными или картой, когда попросите счёт</div>
              </div>
            </button>
            <button className={`pay-option${later ? '' : ' on'}`} onClick={() => setLater(false)}>
              <KaspiMark />
              <div className="grow">
                <b>Сейчас в Kaspi</b>
                <div className="small muted">Заказ уйдёт на кухню после оплаты</div>
              </div>
            </button>
          </div>
        ) : (
          <div className="row pay-single">
            {kaspi ? <KaspiMark /> : <Icon name="waiter" />}
            <span className="grow strong">{kaspi ? 'Kaspi' : 'Официанту, наличными или картой'}</span>
          </div>
        )}
        {menu && !canPay && (
          <div className="note">
            <Icon name="info" />
            <div>У этого заведения не подключены способы оплаты.</div>
          </div>
        )}
      </div>

      <div className="pad bottom-bar cart-bar">
        <div className="row between cart-total">
          <span className="muted">Итого</span>
          <span className="price">{money(cartTotal(cart.lines))}</span>
        </div>
        <button className="btn" disabled={!canPay} onClick={send}>
          {payNow ? (
            <>
              <KaspiMark /> Оплатить в Kaspi
            </>
          ) : (
            'Отправить на кухню'
          )}
        </button>
      </div>
    </div>
  );
}
