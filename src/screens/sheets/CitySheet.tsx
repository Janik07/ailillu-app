import { useMemo } from 'react';
import { useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { useData } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/parts';
import './sheets.css';

export function CitySheet() {
  const nav = useNav();
  const catalog = useData((s) => s.catalog);
  const city = useApp((s) => s.city);
  const setCity = useApp((s) => s.setCity);

  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of catalog ?? []) counts.set(c.city, (counts.get(c.city) ?? 0) + c.branches.length);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [catalog]);

  return (
    <Sheet onClose={nav.pop} label="Город">
      <div className="scroll pad sheet-body">
        <div className="h1 sheet-title">Город</div>
        {cities.map(([name, n]) => (
          <button
            key={name}
            className="list-row"
            onClick={() => {
              setCity(name);
              nav.pop();
            }}
          >
            <span className="grow strong">{name}</span>
            <span className="small muted">{n}</span>
            {name === city && (
              <span className="city-check">
                <Icon name="check" size={18} weight={2.4} />
              </span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
