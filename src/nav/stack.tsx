import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OrderMode } from '../store/app';

export type MenuMode = OrderMode | 'browse';

export type Route =
  | { type: 'venue'; chain: string; branch: number }
  | { type: 'menu'; slug: string; mode: MenuMode; table?: number | null; focus?: string }
  | { type: 'cart' }
  | { type: 'kaspi'; comment: string }
  | { type: 'status'; no: number }
  | { type: 'dish'; slug: string; item: string; mode: MenuMode; table?: number | null }
  | { type: 'index'; slug: string }
  | { type: 'qr'; prefer?: string }
  | { type: 'branches'; chain: string }
  | { type: 'phone'; payNow: boolean; comment: string }
  | { type: 'city' };

/** A venue opens straight into its menu; the venue page is one tap away in the menu header. */
export const menuRoute = (branch: { slug: string; modes: readonly string[] }): Route => ({
  type: 'menu',
  slug: branch.slug,
  mode: branch.modes.includes('takeaway') ? 'takeaway' : 'browse',
});

const SHEETS = new Set<Route['type']>(['dish', 'index', 'qr', 'branches', 'phone', 'city']);
export const isSheet = (r: Route) => SHEETS.has(r.type);

function toHash(r?: Route) {
  if (!r) return '#/';
  if (r.type === 'venue') return `#/venue/${encodeURIComponent(r.chain)}/${r.branch}`;
  if (r.type === 'menu') {
    const table = r.table ? `&table=${r.table}` : '';
    return `#/menu/${encodeURIComponent(r.slug)}?mode=${r.mode}${table}`;
  }
  return `#/${r.type}`;
}

/** Only venues and menus can be opened from a link, the rest needs a guest's session. */
function fromHash(hash: string): Route[] {
  const [path, query] = hash.replace(/^#\/?/, '').split('?');
  const [kind, a, b] = path.split('/').map(decodeURIComponent);
  if (kind === 'venue' && a) return [{ type: 'venue', chain: a, branch: Number(b) || 0 }];
  if (kind === 'menu' && a) {
    const q = new URLSearchParams(query);
    const mode = q.get('mode');
    const table = Number(q.get('table')) || null;
    return [{ type: 'menu', slug: a, mode: mode === 'table' || mode === 'takeaway' ? mode : 'browse', table }];
  }
  return [];
}

interface Nav {
  push: (route: Route) => void;
  pop: () => void;
  /** Swaps the top entry, so Back skips it: a sheet that led to a screen, for example. */
  replaceTop: (route: Route) => void;
  /** Forgets the whole stack and opens these routes above the tabs. */
  reset: (routes: Route[]) => void;
}

const NavContext = createContext<Nav | null>(null);
const StackContext = createContext<Route[]>([]);

/**
 * A native-style stack on top of browser history: each route is one history
 * entry, so the phone's Back button closes sheets and leaves screens as guests
 * expect. Every screen in the stack stays mounted, which keeps scroll positions,
 * filters and the map exactly as they were left.
 */
export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>(() => (history.state?.stack as Route[] | undefined) ?? []);
  const current = useRef(stack);
  const pendingReset = useRef<Route[] | null>(null);

  const nav = useMemo<Nav>(() => {
    const apply = (next: Route[]) => {
      current.current = next;
      setStack(next);
    };
    const push = (route: Route) => {
      const next = [...current.current, route];
      history.pushState({ stack: next }, '', toHash(route));
      apply(next);
    };
    return {
      push,
      pop: () => {
        if (current.current.length && !pendingReset.current) history.back();
      },
      replaceTop: (route) => {
        const next = [...current.current.slice(0, -1), route];
        history.replaceState({ stack: next }, '', toHash(route));
        apply(next);
      },
      reset: (routes) => {
        const depth = current.current.length;
        if (!depth) {
          routes.forEach(push);
          return;
        }
        pendingReset.current = routes;
        history.go(-depth);
      },
    };
  }, []);

  useEffect(() => {
    if (!history.state?.stack) {
      // First visit: the base entry is the tabs, a deep link sits on top of it.
      const deep = fromHash(location.hash);
      history.replaceState({ stack: [] }, '', '#/');
      deep.forEach(nav.push);
    }
    const onPop = (e: PopStateEvent) => {
      const next = (e.state?.stack as Route[] | undefined) ?? [];
      current.current = next;
      setStack(next);
      const routes = pendingReset.current;
      if (routes) {
        pendingReset.current = null;
        routes.forEach(nav.push);
      }
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [nav]);

  return (
    <NavContext.Provider value={nav}>
      <StackContext.Provider value={stack}>{children}</StackContext.Provider>
    </NavContext.Provider>
  );
}

export function useNav() {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav outside NavProvider');
  return nav;
}

export const useStack = () => useContext(StackContext);
