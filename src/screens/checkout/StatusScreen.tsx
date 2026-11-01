import { money } from '../../domain/format';
import { useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { Icon } from '../../ui/Icon';
import { Header, Photo } from '../../ui/parts';
import './checkout.css';

export function StatusScreen({ no }: { no: number }) {
  const nav = useNav();
  const order = useApp((s) => s.orders.find((o) => o.no === no));
  const toast = useApp((s) => s.toast);
  if (!order) return null;

  return (
    <div className="screen pushed">
      <Header title={`Заказ №${order.no}`} sub={order.title + (order.table ? ` · стол ${order.table}` : ' · с собой')} onBack={nav.pop} />
      <div className="scroll pad status-scroll">
        <span className="status-mark">
          <Icon name="check" size={30} weight={2.4} />
        </span>
        <h1 className="h1 status-title">{order.table ? 'Заказ передан на кухню' : 'Заказ принят'}</h1>
        <p className="muted status-text">
          {order.time}.{' '}
          {order.table
            ? `Официант принесёт его к столу ${order.table}. Если долго нет, позовите официанта.`
            : `Заберите на кассе, назовите номер ${order.no}.`}
        </p>
        <div className="status-lines">
          {order.lines.map((l) => (
            <div key={l.itemId + l.mods} className="row status-line">
              {l.image && <Photo base="dalle" path={l.image} className="index-img" />}
              <span className="grow strong">
                {l.name}
                {l.mods && <span className="small muted"> · {l.mods}</span>}
              </span>
              <span className="muted">× {l.qty}</span>
            </div>
          ))}
          <div className="row between status-sum">
            <span className="muted">{order.paid ? 'Оплачен в Kaspi' : 'Не оплачен · оплата официанту'}</span>
            <b className="price">{money(order.total)}</b>
          </div>
        </div>
        <div className="note status-note">
          <Icon name="info" />
          <div>Этапов «готовится → готово» нет: касса их не присылает. Это честный статус, а не прыжок к «готово».</div>
        </div>
      </div>
      {order.table && (
        <div className="pad row bottom-bar status-bar">
          <button className="btn ghost" onClick={() => toast({ text: 'Официант получит вызов', sub: 'Демо: вызов не отправляется' })}>
            <Icon name="waiter" />
            Официант
          </button>
          <button className="btn" onClick={() => nav.push({ type: 'menu', slug: order.slug, mode: 'table', table: order.table })}>
            <Icon name="plus" />
            Дозаказать
          </button>
        </div>
      )}
    </div>
  );
}
