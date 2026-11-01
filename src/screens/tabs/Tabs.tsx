import { useEffect } from 'react';
import { money } from '../../domain/format';
import { useNav } from '../../nav/stack';
import { useApp, type Theme } from '../../store/app';
import { useData } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { ChainThumb, Photo } from '../../ui/parts';
import './tabs.css';

export function OrdersTab() {
  const nav = useNav();
  const orders = useApp((s) => s.orders);
  return (
    <div className="screen with-tabs">
      <div className="pad tab-head">
        <h1 className="h1">Заказы</h1>
      </div>
      <div className="scroll pad">
        {orders.length ? (
          orders.map((o) => (
            <button key={o.no} className="list-row" onClick={() => nav.push({ type: 'status', no: o.no })}>
              {o.lines[0]?.image && <Photo base="dalle" path={o.lines[0].image} className="thumb sm" />}
              <div className="grow">
                <div className="strong">{o.title}</div>
                <div className="small muted">
                  №{o.no} · {o.time} · {o.table ? `стол ${o.table}` : 'с собой'}
                </div>
              </div>
              <span className="price">{money(o.total)}</span>
            </button>
          ))
        ) : (
          <p className="muted tab-empty">Здесь появятся ваши заказы. Начните с кнопки QR внизу.</p>
        )}
      </div>
    </div>
  );
}

export function FavoritesTab() {
  const nav = useNav();
  const catalog = useData((s) => s.catalog);
  const favorites = useApp((s) => s.favorites);
  const list = (catalog ?? []).filter((c) => favorites.includes(c.id));
  return (
    <div className="screen with-tabs">
      <div className="pad tab-head">
        <h1 className="h1">Избранное</h1>
      </div>
      <div className="scroll pad">
        {list.length ? (
          list.map((c) => (
            <button key={c.id} className="list-row" onClick={() => nav.push({ type: 'venue', chain: c.id, branch: 0 })}>
              <ChainThumb chain={c} size={52} />
              <div className="grow">
                <b>{c.title}</b>
                <div className="small muted">{c.type}</div>
              </div>
            </button>
          ))
        ) : (
          <p className="muted tab-empty">Отмечайте места сердечком, они появятся здесь.</p>
        )}
      </div>
    </div>
  );
}

const THEMES: [Theme, string][] = [
  ['auto', 'Как в системе'],
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
];

export function ProfileTab() {
  const phone = useApp((s) => s.phone);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const resetAll = useApp((s) => s.resetAll);
  return (
    <div className="screen with-tabs">
      <div className="scroll pad tab-head">
        <h1 className="h1">Профиль</h1>
        {phone ? (
          <p className="muted">
            +7 {phone.slice(0, 3)} ••• {phone.slice(6, 8)} {phone.slice(8)}
          </p>
        ) : (
          <div className="note profile-note">
            <div>
              <b>Вы не вошли</b>
              <br />
              Номер спросим только при отправке заказа.
            </div>
          </div>
        )}
        <div className="h2 profile-heading">Тема</div>
        <div className="seg profile-themes">
          {THEMES.map(([k, t]) => (
            <button key={k} className={theme === k ? 'on' : ''} onClick={() => setTheme(k)}>
              {t}
            </button>
          ))}
        </div>
        <div className="note profile-note">
          <Icon name="info" />
          <div>
            <b>Это демо</b>
            <br />
            Заведения, меню, цены и столы настоящие, из ailillu.kz. Заказы, SMS, Kaspi и вызовы официанта только имитируются и никуда не
            отправляются.
          </div>
        </div>
        <button className="btn ghost profile-reset" onClick={resetAll}>
          Сбросить данные демо
        </button>
      </div>
    </div>
  );
}

/** Applies the theme chosen in the profile to the page. */
export function useThemeEffect() {
  const theme = useApp((s) => s.theme);
  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
}
