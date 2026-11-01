import { lazy, Suspense, useEffect, useState } from 'react';
import { isSheet, NavProvider, useNav, useStack, type Route } from './nav/stack';
import { HomeScreen } from './screens/home/HomeScreen';
import { FavoritesTab, OrdersTab, ProfileTab, useThemeEffect } from './screens/tabs/Tabs';
import { useData } from './store/data';
import { Icon, type IconName } from './ui/Icon';
import { Spinner, Toast } from './ui/parts';

// Home is what every guest sees first; everything else loads when it is opened.
const VenueScreen = lazy(() => import('./screens/venue/VenueScreen').then((m) => ({ default: m.VenueScreen })));
const MenuScreen = lazy(() => import('./screens/menu/MenuScreen').then((m) => ({ default: m.MenuScreen })));
const DishSheet = lazy(() => import('./screens/menu/DishSheet').then((m) => ({ default: m.DishSheet })));
const IndexSheet = lazy(() => import('./screens/menu/IndexSheet').then((m) => ({ default: m.IndexSheet })));
const CartScreen = lazy(() => import('./screens/checkout/CartScreen').then((m) => ({ default: m.CartScreen })));
const KaspiScreen = lazy(() => import('./screens/checkout/KaspiScreen').then((m) => ({ default: m.KaspiScreen })));
const StatusScreen = lazy(() => import('./screens/checkout/StatusScreen').then((m) => ({ default: m.StatusScreen })));
const PhoneSheet = lazy(() => import('./screens/checkout/PhoneSheet').then((m) => ({ default: m.PhoneSheet })));
const QrSheet = lazy(() => import('./screens/sheets/QrSheet').then((m) => ({ default: m.QrSheet })));
const BranchesSheet = lazy(() => import('./screens/sheets/BranchesSheet').then((m) => ({ default: m.BranchesSheet })));
const CitySheet = lazy(() => import('./screens/sheets/CitySheet').then((m) => ({ default: m.CitySheet })));

type Tab = 'home' | 'favorites' | 'orders' | 'profile';

const LEFT_TABS: [Tab, IconName, string][] = [
  ['home', 'home', 'Главная'],
  ['favorites', 'heart', 'Избранное'],
];
const RIGHT_TABS: [Tab, IconName, string][] = [
  ['orders', 'receipt', 'Заказы'],
  ['profile', 'user', 'Профиль'],
];

function RouteView({ route, active }: { route: Route; active: boolean }) {
  switch (route.type) {
    case 'venue':
      return <VenueScreen chainId={route.chain} index={route.branch} />;
    case 'menu':
      return <MenuScreen slug={route.slug} mode={route.mode} table={route.table} focus={route.focus} />;
    case 'cart':
      return <CartScreen active={active} />;
    case 'kaspi':
      return <KaspiScreen />;
    case 'status':
      return <StatusScreen no={route.no} />;
    case 'dish':
      return <DishSheet slug={route.slug} itemId={route.item} mode={route.mode} table={route.table} />;
    case 'index':
      return <IndexSheet slug={route.slug} />;
    case 'qr':
      return <QrSheet prefer={route.prefer} />;
    case 'branches':
      return <BranchesSheet chainId={route.chain} />;
    case 'phone':
      return <PhoneSheet payNow={route.payNow} comment={route.comment} />;
    case 'city':
      return <CitySheet />;
  }
}

function RouteLoading({ sheet }: { sheet: boolean }) {
  return (
    <div className={sheet ? 'route-loading sheet-loading' : 'route-loading'}>
      <Spinner label="Открываем" />
    </div>
  );
}

const routeKey = (route: Route, index: number) => `${index}-${JSON.stringify(route)}`;

function Shell() {
  const nav = useNav();
  const stack = useStack();
  const [tab, setTab] = useState<Tab>('home');
  const onTabs = stack.every(isSheet);

  const tabButton = ([key, icon, label]: [Tab, IconName, string]) => (
    <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
      <Icon name={icon} size={24} />
      {label}
    </button>
  );

  return (
    <>
      {/* Screens below the top one stay mounted, inert keeps them out of reach. */}
      <div inert={stack.length > 0} className="layer">
        {tab === 'home' && <HomeScreen />}
        {tab === 'favorites' && <FavoritesTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'profile' && <ProfileTab />}
        {onTabs && (
          <nav className="tabbar">
            {LEFT_TABS.map(tabButton)}
            <button aria-label="Сканировать QR" onClick={() => nav.push({ type: 'qr' })}>
              <span className="qr">
                <Icon name="qr" size={26} weight={2} />
              </span>
            </button>
            {RIGHT_TABS.map(tabButton)}
          </nav>
        )}
      </div>

      {stack.map((route, i) => (
        <div key={routeKey(route, i)} inert={i < stack.length - 1} className={isSheet(route) ? 'layer sheet-layer' : 'layer'}>
          {/* One boundary per route: a screen still loading must not blank the ones below it. */}
          <Suspense fallback={<RouteLoading sheet={isSheet(route)} />}>
            <RouteView route={route} active={i === stack.length - 1} />
          </Suspense>
        </div>
      ))}

      <Toast />
    </>
  );
}

export function App() {
  const loadCatalog = useData((s) => s.loadCatalog);
  useThemeEffect();
  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}
