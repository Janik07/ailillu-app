import { useMemo, useState } from 'react';
import { money } from '../../domain/format';
import type { MenuItem } from '../../domain/menu';
import { defaultSelection, dropOption, firstMissing, pickOption, unitPrice } from '../../domain/modifiers';
import { useNav, type MenuMode } from '../../nav/stack';
import { useApp } from '../../store/app';
import { useMenu } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { Photo, Sheet, Spinner, Stepper } from '../../ui/parts';
import './dish.css';

function Modifiers({ item, sel, setSel, missing }: { item: MenuItem; sel: ReturnType<typeof defaultSelection>; setSel: (s: ReturnType<typeof defaultSelection>) => void; missing: number }) {
  const [opened, setOpened] = useState<Record<number, boolean>>({});

  return item.groups.map((g, gi) => {
    if (g.kind === 'set') {
      return (
        <div key={gi} className="mod-group">
          <div className="row between">
            <b>В сете</b>
            <span className="small muted">{g.options.length}</span>
          </div>
          {g.options.map((o) => (
            <div key={o.id} className="row set-line">
              <Icon name="check" size={18} weight={2.4} />
              {o.name}
            </div>
          ))}
        </div>
      );
    }

    const shown = opened[gi] || g.options.length <= 8 ? g.options : g.options.slice(0, 6);
    const hidden = g.options.length - shown.length;
    const head = (
      <div className="row between mod-head">
        <b>{g.name}</b>
        {g.required ? (
          <span className={`badge${missing === gi ? ' alert' : ''}`}>{missing === gi ? 'выберите' : 'обязательно'}</span>
        ) : (
          <span className="small muted">{g.max < 99 ? `до ${g.max}` : 'по желанию'}</span>
        )}
      </div>
    );

    if (g.kind === 'one') {
      return (
        <div key={gi} className="mod-group">
          {head}
          <div className="chips wrap">
            {shown.map((o) => (
              <button
                key={o.id}
                className={`chip${sel[gi]?.[o.id] ? ' on' : ''}`}
                onClick={() => setSel(pickOption(sel, item, gi, o.id))}
              >
                {o.name}
                {o.price > 0 && <span className="muted">+{money(o.price)}</span>}
              </button>
            ))}
            {hidden > 0 && (
              <button className="chip" onClick={() => setOpened({ ...opened, [gi]: true })}>
                Ещё {hidden}
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={gi} className="mod-group">
        {head}
        {shown.map((o) => {
          const n = sel[gi]?.[o.id] ?? 0;
          return (
            <div key={o.id} className="row mod-line">
              <span className="grow item-name">{o.name}</span>
              {o.price > 0 && <span className="small muted">+{money(o.price)}</span>}
              {n ? (
                <Stepper
                  qty={n}
                  onChange={(v) => setSel(v < n ? dropOption(sel, gi, o.id) : pickOption(sel, item, gi, o.id))}
                />
              ) : (
                <button className="iconbtn tiny" aria-label={`Добавить ${o.name}`} onClick={() => setSel(pickOption(sel, item, gi, o.id))}>
                  <Icon name="plus" size={16} weight={2.2} />
                </button>
              )}
            </div>
          );
        })}
        {hidden > 0 && (
          <button className="btn link start mod-more" onClick={() => setOpened({ ...opened, [gi]: true })}>
            Ещё {hidden}
          </button>
        )}
      </div>
    );
  });
}

export function DishSheet({ slug, itemId, mode, table }: { slug: string; itemId: string; mode: MenuMode; table?: number | null }) {
  const nav = useNav();
  const { menu } = useMenu(slug);
  const item = useMemo(() => menu?.sections.flatMap((s) => s.items).find((i) => i.id === itemId), [menu, itemId]);

  if (!menu || !item) {
    return (
      <Sheet onClose={nav.pop} label="Блюдо">
        <Spinner label="Загружаем блюдо" />
      </Sheet>
    );
  }
  return <DishBody key={item.id} item={item} mode={mode} table={table} slug={slug} />;
}

function DishBody({ item, mode, table, slug }: { item: MenuItem; mode: MenuMode; table?: number | null; slug: string }) {
  const nav = useNav();
  // The cart needs the whole menu; DishSheet renders this only once it has loaded.
  const { menu } = useMenu(slug);
  const addToCart = useApp((s) => s.addToCart);
  const toast = useApp((s) => s.toast);
  const [sel, setSel] = useState(() => defaultSelection(item));
  const [qty, setQty] = useState(1);
  const missing = firstMissing(item, sel);
  const facts = [item.volume, item.weight ? `${item.weight} г` : null, money(item.price)].filter(Boolean).join(' · ');

  return (
    <Sheet onClose={nav.pop} label={item.name}>
      <div className="scroll">
        {item.image && <Photo base="dalle" path={item.image} wide className="dish-photo" eager />}
        <div className="pad dish-body">
          <div className="h1 dish-title">{item.name}</div>
          <div className="muted dish-facts">{facts}</div>
          {item.description && <p className="dish-about">{item.description}</p>}
          <Modifiers item={item} sel={sel} setSel={setSel} missing={missing} />
        </div>
      </div>
      <div className="pad row dish-bar">
        {mode === 'browse' ? (
          <button className="btn" disabled>
            Заказать можно за столом или с собой
          </button>
        ) : (
          <>
            <Stepper qty={qty} onChange={(v) => setQty(Math.max(1, v))} />
            <button
              className="btn"
              disabled={missing >= 0}
              onClick={() => {
                if (!menu) return;
                addToCart(menu, item, sel, qty, mode, table ?? null);
                toast({ text: 'Добавлено в корзину' });
                nav.pop();
              }}
            >
              {missing >= 0 ? `Выберите: ${item.groups[missing].name.toLowerCase()}` : `Добавить · ${money(unitPrice(item, sel) * qty)}`}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
