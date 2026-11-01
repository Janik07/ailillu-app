import { useMemo, useState } from 'react';
import { useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { useData, useMenu } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { Sheet, Spinner } from '../../ui/parts';
import './sheets.css';

function Tables({ slug, onBack }: { slug: string; onBack?: () => void }) {
  const nav = useNav();
  const setCartMode = useApp((s) => s.setCartMode);
  const { menu, failed, retry } = useMenu(slug);

  const enter = (table: number) => {
    if (useApp.getState().cart?.slug === slug) setCartMode('table', table);
    nav.replaceTop({ type: 'menu', slug, mode: 'table', table });
  };

  if (failed) {
    return (
      <button className="btn ghost" onClick={retry}>
        Повторить загрузку
      </button>
    );
  }
  if (!menu) return <Spinner label="Загружаем столы" />;
  return (
    <>
      <div className="row between qr-venue">
        <b>{menu.title}</b>
        {onBack && (
          <button className="text-link" onClick={onBack}>
            другое место
          </button>
        )}
      </div>
      {menu.tables.length ? (
        <div className="tables">
          {menu.tables.map((t) => (
            <button key={t} className="table-btn" onClick={() => enter(t)}>
              {t}
            </button>
          ))}
        </div>
      ) : (
        <div className="note">
          <Icon name="info" />
          <div>У этого заведения в системе нет столов.</div>
        </div>
      )}
    </>
  );
}

/**
 * Demo stand-in for the camera: picking a table gives the same result as
 * scanning its QR. The table numbers are the venue's real ones.
 */
export function QrSheet({ prefer }: { prefer?: string }) {
  const nav = useNav();
  const city = useApp((s) => s.city);
  const catalog = useData((s) => s.catalog);
  const [slug, setSlug] = useState(prefer ?? null);
  const [query, setQuery] = useState('');

  const places = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog ?? [])
      .filter((c) => c.city === city)
      .flatMap((c) => c.branches.filter((b) => b.modes.includes('table')))
      .filter((b) => !q || b.name.toLowerCase().includes(q));
  }, [catalog, city, query]);

  return (
    <Sheet onClose={nav.pop} label="Сканировать QR">
      <div className="pad qr-head">
        <div className="h1 sheet-title">Наведите на QR на столе</div>
        <p className="small muted">Демо: камера не открывается, выберите стол вручную.</p>
      </div>
      <div className="scroll pad sheet-body">
        {slug ? (
          <Tables slug={slug} onBack={prefer ? undefined : () => setSlug(null)} />
        ) : (
          <>
            <label className="search">
              <Icon name="search" />
              <input
                id="qr-search"
                placeholder="Где вы сидите?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </label>
            {places.map((b) => (
              <button key={b.slug} className="list-row" onClick={() => setSlug(b.slug)}>
                <Icon name="seat" />
                <div className="grow">
                  <div className="strong">{b.name}</div>
                  <div className="small muted">{b.address}</div>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}
