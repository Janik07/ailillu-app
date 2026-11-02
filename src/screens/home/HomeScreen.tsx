import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Chain } from '../../domain/catalog';
import { money, plural } from '../../domain/format';
import { distanceKm, distanceLabel, type Point } from '../../domain/geo';
import type { DishEntry } from '../../domain/menu';
import { menuRoute, useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { loadDishIndex, useData } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { ChainThumb, LoadError, Modes, Photo, Spinner } from '../../ui/parts';
import './home.css';

const MapView = lazy(() => import('./MapView'));

const COLLECTIONS: [string, string][] = [
  ['breakfast', 'Завтраки'],
  ['bar', 'Бар'],
  ['sushi', 'Суши'],
  ['doner', 'Донеры и бургеры'],
];

const nearest = (c: Chain, me: Point | null) => {
  if (!me) return Infinity;
  const km = c.branches.filter((b) => b.lat != null).map((b) => distanceKm(me, b as Point));
  return km.length ? Math.min(...km) : Infinity;
};

interface DishHit {
  chain: Chain;
  slug: string;
  dish: DishEntry;
}

/** Waits for a pause in typing, then looks through every venue's dishes. */
function useDishSearch(query: string, chains: Chain[]) {
  const [hits, setHits] = useState<DishHit[]>([]);
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) {
      setHits([]);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const index = await loadDishIndex();
      if (!live) return;
      const byId = new Map(chains.map((c) => [c.id, c]));
      const found: DishHit[] = [];
      for (const row of index) {
        const chain = byId.get(row.chain);
        if (!chain) continue;
        for (const dish of row.dishes) {
          if (dish[1].toLowerCase().includes(q)) found.push({ chain, slug: row.slug, dish });
        }
      }
      setHits(found.slice(0, 6));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, chains]);
  return hits;
}

export function HomeScreen() {
  const nav = useNav();
  const catalog = useData((s) => s.catalog);
  const failed = useData((s) => s.catalogFailed);
  const loadCatalog = useData((s) => s.loadCatalog);
  const city = useApp((s) => s.city);
  const me = useApp((s) => s.me);
  const locate = useApp((s) => s.locate);
  const visited = useApp((s) => s.visited);
  const favorites = useApp((s) => s.favorites);
  const toggleFavorite = useApp((s) => s.toggleFavorite);

  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [filter, setFilter] = useState<string | null>(null);

  const inCity = useMemo(() => (catalog ?? []).filter((c) => c.city === city), [catalog, city]);
  const places = inCity.reduce((a, c) => a + c.branches.length, 0);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = inCity.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q) && !c.branches.some((b) => b.name.toLowerCase().includes(q))) return false;
      if (filter === 'takeaway' || filter === 'delivery') return c.modes.includes(filter);
      return !filter || c.tags.includes(filter);
    });
    return me ? found.sort((a, b) => nearest(a, me) - nearest(b, me)) : found;
  }, [inCity, query, filter, me]);

  const dishes = useDishSearch(query, inCity);
  const filters: [string, string][] = [['takeaway', 'С собой'], ['delivery', 'Доставка'], ...COLLECTIONS];
  const visitedChains = visited.map((id) => inCity.find((c) => c.id === id)).filter((c): c is Chain => !!c);
  const idle = !query && !filter;

  const open = (c: Chain) => {
    if (c.branches.length > 1) nav.push({ type: 'branches', chain: c.id });
    else nav.push(menuRoute(c.branches[0]));
  };

  return (
    <div className="screen with-tabs">
      <div className="pad home-top">
        <div className="row between">
          <button className="city" onClick={() => nav.push({ type: 'city' })}>
            <span className="city-name">
              <span className="h1">{city}</span>
              <Icon name="chev" />
            </span>
            <span className="small muted">
              {places} {plural(places, 'заведение', 'заведения', 'заведений')}
            </span>
          </button>
          <div className="seg compact">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="Список">
              <Icon name="list" size={18} />
            </button>
            <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')} aria-label="Карта">
              <Icon name="map" size={18} />
            </button>
          </div>
        </div>
        <label className="search home-search">
          <Icon name="search" />
          <input
            id="home-search"
            placeholder="Заведение или блюдо"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="chips home-filters">
          {filters.map(([k, t]) => (
            <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(filter === k ? null : k)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {failed && !catalog && <LoadError text="Не удалось загрузить заведения" onRetry={() => void loadCatalog()} />}

      {view === 'map' && (
        <Suspense fallback={<Spinner label="Открываем карту" />}>
          <MapView chains={list} city={city} />
        </Suspense>
      )}

      {view === 'list' && (
        <div className="scroll pad home-list">
          {!catalog && !failed && (
            <div aria-label="Загружаем заведения">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div className="skeleton-row" key={i}>
                  <i />
                  <span />
                </div>
              ))}
            </div>
          )}

          {dishes.length > 0 && (
            <section className="home-block">
              <div className="h2 home-sub">Блюда</div>
              {dishes.map(({ chain, slug, dish }) => (
                <button
                  key={slug + dish[0]}
                  className="list-row"
                  onClick={() => nav.push({ type: 'menu', slug, mode: 'browse', focus: dish[0] })}
                >
                  <ChainThumb chain={chain} size={52} />
                  <div className="grow">
                    <div className="strong">{dish[1]}</div>
                    <div className="small muted">
                      {chain.title} · {money(dish[2])}
                    </div>
                  </div>
                  <Icon name="right" size={16} />
                </button>
              ))}
            </section>
          )}

          {idle && visitedChains.length > 0 && (
            <section className="home-block">
              <div className="small muted label">ВЫ БЫЛИ</div>
              <div className="chips home-visited">
                {visitedChains.map((c) => (
                  <button key={c.id} className="chip tall" onClick={() => open(c)}>
                    <ChainThumb chain={c} size={36} />
                    {c.title}
                  </button>
                ))}
              </div>
            </section>
          )}

          {idle && catalog && (
            <section className="home-block">
              <div className="h2">Куда пойти</div>
              <div className="chips collections">
                {COLLECTIONS.map(([k, t]) => {
                  const tagged = inCity.filter((c) => c.tags.includes(k));
                  const n = tagged.reduce((a, c) => a + c.branches.length, 0);
                  if (!n) return null;
                  return (
                    <button key={k} className="collection" onClick={() => setFilter(k)}>
                      <Photo base="restaurant" path={tagged.find((c) => c.photo)?.photo} className="collection-img" />
                      <span className="collection-shade" />
                      <span className="collection-text">
                        <b>{t}</b>
                        <span>
                          {n} {plural(n, 'место', 'места', 'мест')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {catalog && (
            <div className="row between home-heading">
              <span className="h2">{filter ? filters.find((f) => f[0] === filter)?.[1] : 'Все заведения'}</span>
              {me ? (
                <span className="small muted">ближе к вам выше</span>
              ) : (
                <button className="near" onClick={() => void locate()}>
                  <Icon name="locate" size={15} />
                  Рядом со мной
                </button>
              )}
            </div>
          )}

          {list.map((c) => {
            const km = nearest(c, me);
            return (
              <div key={c.id} className="list-row venue-row">
                <button className="venue-open" onClick={() => open(c)}>
                  <ChainThumb chain={c} />
                  <div className="grow">
                    <div className="venue-title">{c.title}</div>
                    <div className="small muted">
                      {c.type}
                      {c.check > 0 && ` · ~${money(c.check)}`}
                    </div>
                    {km < Infinity && (
                      <div className="small walk">
                        <Icon name="walk" size={13} weight={2} />
                        {distanceLabel(km)}
                      </div>
                    )}
                    <Modes modes={c.modes} />
                  </div>
                </button>
                {c.branches.length > 1 ? (
                  <div className="small muted branches-count">
                    <b>{c.branches.length}</b>
                    {plural(c.branches.length, 'точка', 'точки', 'точек')}
                  </div>
                ) : (
                  <button
                    className={`fav${favorites.includes(c.id) ? ' on' : ''}`}
                    aria-label="В избранное"
                    aria-pressed={favorites.includes(c.id)}
                    onClick={() => toggleFavorite(c.id)}
                  >
                    <Icon name="heart" />
                  </button>
                )}
              </div>
            );
          })}

          {catalog && !list.length && <p className="muted">Ничего не нашли. Попробуйте другое слово или снимите фильтр.</p>}
        </div>
      )}
    </div>
  );
}
