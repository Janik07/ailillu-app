import { useEffect } from 'react';
import { money, plural } from '../../domain/format';
import { distanceKm, distanceLabel, type Point } from '../../domain/geo';
import { GROUP_NAMES, GROUP_ORDER } from '../../domain/menu';
import { useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { useChain, useMenu } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { LoadError, Photo, Spinner } from '../../ui/parts';
import './venue.css';

export function VenueScreen({ chainId, index }: { chainId: string; index: number }) {
  const nav = useNav();
  const chain = useChain(chainId);
  const branch = chain?.branches[index] ?? chain?.branches[0];
  const { menu, failed, retry } = useMenu(branch?.slug ?? '');
  const me = useApp((s) => s.me);
  const visit = useApp((s) => s.visit);
  const favorite = useApp((s) => s.favorites.includes(chainId));
  const toggleFavorite = useApp((s) => s.toggleFavorite);

  useEffect(() => visit(chainId), [chainId, visit]);

  if (!chain || !branch) {
    return (
      <div className="screen pushed">
        <Spinner label="Загружаем заведение" />
      </div>
    );
  }

  const takeaway = !!menu?.canTakeaway && branch.modes.includes('takeaway');
  const table = branch.modes.includes('table');
  const km = me && branch.lat != null ? distanceKm(me, branch as Point) : null;
  const counts = menu
    ? GROUP_ORDER.map((g) => [g, menu.sections.filter((s) => s.group === g).reduce((a, s) => a + s.items.length, 0)] as const).filter(
        ([, n]) => n > 0,
      )
    : [];
  const openMenu = (mode: 'browse' | 'takeaway') => nav.push({ type: 'menu', slug: branch.slug, mode });

  return (
    <div className="screen pushed">
      <div className="scroll venue-scroll">
        <div className="venue-cover">
          <Photo base="restaurant" path={branch.photo ?? chain.photo} wide className="venue-photo" eager />
          <button className="iconbtn on-photo left" aria-label="Назад" onClick={nav.pop}>
            <Icon name="back" />
          </button>
          <button
            className={`iconbtn on-photo right${favorite ? ' fav-on' : ''}`}
            aria-label="В избранное"
            aria-pressed={favorite}
            onClick={() => toggleFavorite(chainId)}
          >
            <Icon name="heart" />
          </button>
        </div>
        <div className="pad venue-body">
          <h1 className="h1">{chain.title}</h1>
          {chain.branches.length > 1 && (
            <button className="venue-branch" onClick={() => nav.push({ type: 'branches', chain: chain.id })}>
              {branch.short} · ещё {chain.branches.length - 1}
              <Icon name="chev" size={16} />
            </button>
          )}
          <div className="muted venue-line">
            {chain.type}
            {chain.check > 0 && ` · ~${money(chain.check)} на человека`}
          </div>
          {branch.hours && (
            <div className="venue-line row-tight">
              <Icon name="clock" size={16} />
              {branch.hours}
            </div>
          )}
          <div className="muted venue-line row-tight">
            <Icon name="pin" size={16} />
            <span>
              {branch.address}
              {km != null && ` · ${distanceLabel(km)}`}
            </span>
          </div>
          {menu?.description && <p className="venue-about">{menu.description}</p>}

          <div className="h2 venue-heading">Как заказать</div>
          {takeaway && table ? (
            <div className="row venue-ways">
              <div className="way on">
                <Icon name="bag" size={22} />
                <b>С собой</b>
                <span className="small muted">Закажите сейчас, заберёте на кассе</span>
              </div>
              <div className="way">
                <Icon name="seat" size={22} />
                <b>За столом</b>
                <span className="small muted">Отсканируйте QR на столе</span>
              </div>
            </div>
          ) : (
            <div className="note venue-ways">
              <Icon name={takeaway ? 'bag' : 'qr'} size={24} />
              <div>
                <b>{takeaway ? 'Только с собой' : 'Только за столом'}</b>
                <br />
                {takeaway
                  ? 'Закажите сейчас, заберёте на кассе.'
                  : 'Сядьте и отсканируйте QR на столе: меню откроется сразу, заказ принесут к столу.'}
              </div>
            </div>
          )}

          <div className="h2 venue-heading">Меню</div>
          {failed && <LoadError text="Меню не загрузилось" onRetry={retry} />}
          {!menu && !failed && <Spinner label="Загружаем меню" />}
          {menu && (
            <>
              <button className="row venue-groups" onClick={() => openMenu('browse')}>
                {counts.map(([g, n]) => (
                  <div key={g} className="venue-group">
                    <b>{GROUP_NAMES[g]}</b>
                    <div className="small muted">
                      {n} {plural(n, 'позиция', 'позиции', 'позиций')}
                    </div>
                  </div>
                ))}
              </button>
              <button className="btn link start" onClick={() => openMenu('browse')}>
                Смотреть меню
                <Icon name="right" size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="pad bottom-bar venue-bar">
        {takeaway ? (
          <>
            <button className="btn" onClick={() => openMenu('takeaway')}>
              <Icon name="bag" />
              Заказать с собой
            </button>
            {table && (
              <button className="btn link" onClick={() => nav.push({ type: 'qr', prefer: branch.slug })}>
                Я за столом, сканировать QR
              </button>
            )}
          </>
        ) : (
          <button className="btn" onClick={() => nav.push({ type: 'qr', prefer: branch.slug })}>
            <Icon name="qr" />Я в заведении, сканировать QR
          </button>
        )}
      </div>
    </div>
  );
}
