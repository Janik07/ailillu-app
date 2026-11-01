import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { money, plural } from '../../domain/format';
import { GROUP_NAMES, GROUP_ORDER, type MenuItem, type MenuSection, type SectionGroup } from '../../domain/menu';
import { defaultSelection, firstMissing, selectionText } from '../../domain/modifiers';
import { useNav, type MenuMode } from '../../nav/stack';
import { cartCount, cartTotal, useApp } from '../../store/app';
import { useMenu } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { LoadError, Photo, Spinner } from '../../ui/parts';
import './menu.css';

interface ItemProps {
  item: MenuItem;
  qty: number;
  canAdd: boolean;
  onOpen: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

function AddButton({ item, qty, onAdd, className, iconSize }: Pick<ItemProps, 'item' | 'qty' | 'onAdd'> & { className: string; iconSize: number }) {
  return (
    <button
      className={className}
      aria-label={`Добавить ${item.name}`}
      onClick={(e) => {
        e.stopPropagation();
        onAdd(item);
      }}
    >
      {qty ? <b>{qty}</b> : <Icon name="plus" size={iconSize} weight={2.2} />}
    </button>
  );
}

// memo matters here: a 160-item menu must not repaint because one quantity changed.
const ItemCard = memo(function ItemCard({ item, qty, canAdd, onOpen, onAdd }: ItemProps) {
  return (
    <div className="card">
      <button className="card-open" onClick={() => onOpen(item)}>
        <div className="ph">
          <Photo base="dalle" path={item.image} />
        </div>
        <div className="name">
          {item.name}
          {item.volume && <span className="muted vol"> · {item.volume}</span>}
        </div>
        <div className="price">{money(item.price)}</div>
      </button>
      {canAdd && <AddButton item={item} qty={qty} onAdd={onAdd} className="add" iconSize={20} />}
    </div>
  );
});

const ItemRow = memo(function ItemRow({ item, qty, canAdd, onOpen, onAdd }: ItemProps) {
  return (
    <div className="list-row item-row">
      <button className="item-open" onClick={() => onOpen(item)}>
        <span className="grow item-name">
          {item.name}
          {item.volume && <span className="muted"> · {item.volume}</span>}
        </span>
        <span className="price">{money(item.price)}</span>
      </button>
      {canAdd && <AddButton item={item} qty={qty} onAdd={onAdd} className="iconbtn tiny" iconSize={16} />}
    </div>
  );
});

const Section = memo(function Section({
  section,
  quantities,
  canAdd,
  onOpen,
  onAdd,
}: {
  section: MenuSection;
  quantities: Map<string, number>;
  canAdd: boolean;
  onOpen: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}) {
  const Item = section.layout === 'grid' ? ItemCard : ItemRow;
  return (
    <section id={`sec-${section.id}`} data-section={section.id} className={`pad menu-section ${section.layout}`}>
      <div className="h2">
        {section.name} <span className="muted count">{section.items.length}</span>
      </div>
      <div className={section.layout === 'grid' ? 'grid' : undefined}>
        {section.items.map((it) => (
          <Item key={it.id} item={it} qty={quantities.get(it.id) ?? 0} canAdd={canAdd} onOpen={onOpen} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
});

const NO_QUANTITIES = new Map<string, number>();

interface Props {
  slug: string;
  mode: MenuMode;
  table?: number | null;
  focus?: string;
}

export function MenuScreen({ slug, mode, table, focus }: Props) {
  const nav = useNav();
  const { menu, failed, retry } = useMenu(slug);
  const cart = useApp((s) => s.cart);
  const addToCart = useApp((s) => s.addToCart);
  const toast = useApp((s) => s.toast);
  const jump = useApp((s) => s.jump);
  const clearJump = useApp((s) => s.clearJump);

  const [group, setGroup] = useState<SectionGroup | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const chipRow = useRef<HTMLDivElement>(null);
  const focusDone = useRef(false);

  const browse = mode === 'browse';
  const sections = useMemo(() => {
    if (!menu) return [];
    if (mode !== 'takeaway') return menu.sections;
    return menu.sections
      .map((s) => ({ ...s, items: s.items.filter((i) => !i.noTakeaway) }))
      .filter((s) => s.items.length);
  }, [menu, mode]);

  const regular = useMemo(() => {
    const plain = sections.filter((s) => !s.promo);
    return plain.length ? plain : sections;
  }, [sections]);
  const present = GROUP_ORDER.filter((g) => regular.some((s) => s.group === g));
  const shownGroup = group && present.includes(group) ? group : present[0];
  const visible = useMemo(() => regular.filter((s) => s.group === shownGroup), [regular, shownGroup]);
  const promo = useMemo(
    () => (regular.length < sections.length ? sections.filter((s) => s.promo).flatMap((s) => s.items).slice(0, 10) : []),
    [regular, sections],
  );
  const total = sections.reduce((a, s) => a + s.items.length, 0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return sections.flatMap((s) =>
      s.items.filter((it) => `${it.name} ${s.name}`.toLowerCase().includes(q)).map((item) => ({ item, section: s })),
    );
  }, [query, sections]);

  const lines = cart?.slug === slug ? cart.lines : null;
  const quantities = useMemo(() => {
    if (!lines) return NO_QUANTITIES;
    const map = new Map<string, number>();
    for (const l of lines) map.set(l.itemId, (map.get(l.itemId) ?? 0) + l.qty);
    return map;
  }, [lines]);

  const openItem = useCallback(
    (item: MenuItem) => nav.push({ type: 'dish', slug, item: item.id, mode, table }),
    [nav, slug, mode, table],
  );

  const quickAdd = useCallback(
    (item: MenuItem) => {
      const sel = defaultSelection(item);
      if (!menu || mode === 'browse' || firstMissing(item, sel) >= 0) {
        openItem(item);
        return;
      }
      addToCart(menu, item, sel, 1, mode, table ?? null);
      const mods = selectionText(item, sel);
      toast({
        text: `${item.name} в корзине`,
        sub: mods,
        image: item.image,
        action: mods ? { label: 'Изменить', run: () => openItem(item) } : undefined,
      });
    },
    [menu, mode, table, addToCart, toast, openItem],
  );

  const goToSection = useCallback((id: string) => {
    const go = () => document.getElementById(`sec-${id}`)?.scrollIntoView({ block: 'start' });
    // Sections off screen skip layout, so their height is only an estimate on the first jump.
    go();
    requestAnimationFrame(() => requestAnimationFrame(go));
  }, []);

  useEffect(() => {
    if (!menu || !jump || jump.slug !== slug) return;
    const target = menu.sections.find((s) => s.id === jump.section);
    clearJump();
    if (!target) return;
    setGroup(target.group);
    requestAnimationFrame(() => goToSection(target.id));
  }, [menu, jump, slug, clearJump, goToSection]);

  // A dish found through the search on the home screen opens right away.
  useEffect(() => {
    if (!menu || !focus || focusDone.current) return;
    focusDone.current = true;
    const section = menu.sections.find((s) => s.items.some((i) => i.id === focus));
    if (!section) return;
    if (!section.promo) setGroup(section.group);
    nav.push({ type: 'dish', slug, item: focus, mode, table });
  }, [menu, focus, nav, slug, mode, table]);

  // Highlights the chip of the section the guest is reading.
  useEffect(() => {
    const root = scroller.current;
    if (!root || results) return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.section!;
          if (e.isIntersecting) seen.add(id);
          else seen.delete(id);
        }
        const first = visible.find((s) => seen.has(s.id));
        if (first) setActive(first.id);
      },
      { root, rootMargin: '-140px 0px -60% 0px' },
    );
    root.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visible, results]);

  useEffect(() => {
    if (!active) return;
    const row = chipRow.current;
    const chip = row?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' });
  }, [active]);

  if (failed) {
    return (
      <div className="screen pushed">
        <div className="pad row header">
          <button className="iconbtn" aria-label="Назад" onClick={nav.pop}>
            <Icon name="back" />
          </button>
        </div>
        <LoadError text="Меню не загрузилось" onRetry={retry} />
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="screen pushed">
        <div className="pad row header">
          <button className="iconbtn" aria-label="Назад" onClick={nav.pop}>
            <Icon name="back" />
          </button>
        </div>
        <Spinner label="Загружаем меню" />
      </div>
    );
  }

  const n = lines ? cartCount(lines) : 0;
  const sum = lines ? cartTotal(lines) : 0;
  const context =
    mode === 'table' ? `Стол ${table} · заказ принесут к столу` : mode === 'takeaway' ? 'С собой · заберёте на кассе' : 'Просмотр · заказать можно за столом по QR';

  return (
    <div className="screen pushed">
      <div className="pad row menu-head">
        <button className="iconbtn" aria-label="Назад" onClick={nav.pop}>
          <Icon name="back" />
        </button>
        <div className="grow">
          <div className="menu-title">{menu.title}</div>
          <div className={`small menu-context${browse ? ' quiet' : ''}`}>{context}</div>
        </div>
      </div>

      {mode === 'table' && (menu.canCallWaiter || menu.canCallBill) && (
        <div className="pad chips menu-calls">
          {menu.canCallWaiter && (
            <button className="chip" onClick={() => toast({ text: 'Официант получит вызов', sub: 'Демо: вызов не отправляется' })}>
              <Icon name="waiter" size={17} />
              Официант
            </button>
          )}
          {menu.canCallBill && (
            <button className="chip" onClick={() => toast({ text: 'Счёт попросили', sub: 'Демо: вызов не отправляется' })}>
              <Icon name="bill" size={17} />
              Счёт
            </button>
          )}
        </div>
      )}

      <div className="pad">
        <label className="search">
          <Icon name="search" />
          <input
            id="menu-search"
            placeholder={`Поиск по ${total} ${plural(total, 'позиции', 'позициям', 'позициям')}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
      </div>

      {results ? (
        <div className="scroll pad menu-scroll">
          <div className="small muted menu-found">Найдено: {results.length}</div>
          {results.map(({ item, section }) => (
            <button key={section.id + item.id} className="list-row" onClick={() => openItem(item)}>
              {item.image && <Photo base="dalle" path={item.image} className="thumb sm" />}
              <div className="grow">
                <div className="item-name">{item.name}</div>
                <div className="small muted">
                  {section.name}
                  {item.volume && ` · ${item.volume}`}
                </div>
              </div>
              <span className="price">{money(item.price)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="scroll menu-scroll" ref={scroller}>
          {promo.length > 0 && (
            <div className="pad menu-promo">
              <div className="h2">Новинки и сеты</div>
              <div className="chips promo-list">
                {promo.map((it) => (
                  <button key={it.id} className="promo" onClick={() => openItem(it)}>
                    {it.image && <Photo base="dalle" path={it.image} className="promo-img" />}
                    <div className="grow">
                      <div className="promo-name">{it.name}</div>
                      <div className="small muted">{money(it.price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="pad menu-sticky">
            {present.length > 1 && (
              <div className="seg menu-groups">
                {present.map((g) => (
                  <button
                    key={g}
                    className={shownGroup === g ? 'on' : ''}
                    onClick={() => {
                      setGroup(g);
                      setActive(null);
                      scroller.current?.scrollTo({ top: 0 });
                    }}
                  >
                    {GROUP_NAMES[g]}{' '}
                    <span className="small muted">{regular.filter((s) => s.group === g).reduce((a, s) => a + s.items.length, 0)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="chips menu-chips" ref={chipRow}>
              <button className="chip" aria-label="Всё меню" onClick={() => nav.push({ type: 'index', slug })}>
                <Icon name="list" size={18} />
              </button>
              {visible.map((s) => (
                <button key={s.id} data-chip={s.id} className={`chip${active === s.id ? ' on' : ''}`} onClick={() => goToSection(s.id)}>
                  {s.name} <span className="muted">{s.items.length}</span>
                </button>
              ))}
            </div>
          </div>
          {visible.map((s) => (
            <Section key={s.id} section={s} quantities={quantities} canAdd={!browse} onOpen={openItem} onAdd={quickAdd} />
          ))}
        </div>
      )}

      {n > 0 && (
        <div className="pad bottom-bar menu-cart">
          <button className="btn" onClick={() => nav.push({ type: 'cart' })}>
            <span className="cart-count">
              {n} {plural(n, 'позиция', 'позиции', 'позиций')}
            </span>
            <span>Корзина · {money(sum)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
