import { plural } from '../../domain/format';
import { GROUP_NAMES, GROUP_ORDER } from '../../domain/menu';
import { useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { useMenu } from '../../store/data';
import { Photo, Sheet, Spinner } from '../../ui/parts';

export function IndexSheet({ slug }: { slug: string }) {
  const nav = useNav();
  const setJump = useApp((s) => s.setJump);
  const { menu } = useMenu(slug);
  const total = menu?.sections.reduce((a, s) => a + s.items.length, 0) ?? 0;

  return (
    <Sheet onClose={nav.pop} label="Всё меню">
      {!menu ? (
        <Spinner label="Загружаем меню" />
      ) : (
        <div className="scroll pad sheet-body">
          <div className="row between">
            <span className="h1 sheet-title">Всё меню</span>
            <span className="small muted">
              {total} {plural(total, 'позиция', 'позиции', 'позиций')}
            </span>
          </div>
          {GROUP_ORDER.filter((g) => menu.sections.some((s) => s.group === g && !s.promo)).map((g) => (
            <div key={g}>
              <div className="small muted index-group">{GROUP_NAMES[g].toUpperCase()}</div>
              {menu.sections
                .filter((s) => s.group === g && !s.promo)
                .map((s) => (
                  <button
                    key={s.id}
                    className="list-row index-row"
                    onClick={() => {
                      setJump(slug, s.id);
                      nav.pop();
                    }}
                  >
                    <Photo base="dalle" path={s.items.find((i) => i.image)?.image} className="index-img" />
                    <span className="grow strong">{s.name}</span>
                    <span className="small muted">{s.items.length}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
