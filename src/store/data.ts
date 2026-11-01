import { useEffect } from 'react';
import { create } from 'zustand';
import { fetchMenu, fetchRestaurants } from '../api/client';
import { buildCatalog, type Chain, type VenueMeta } from '../domain/catalog';
import { buildMenu, type DishEntry, type Menu } from '../domain/menu';

interface CatalogSnapshot {
  meta: Record<string, VenueMeta>;
  catalog: Chain[];
}

declare global {
  interface Window {
    /** Set by an inline script in index.html. */
    __catalog?: Promise<CatalogSnapshot>;
  }
}

interface DataState {
  catalog: Chain[] | null;
  catalogFailed: boolean;
  menus: Record<string, Menu>;
  menuFailed: Record<string, boolean>;
  loadCatalog: () => Promise<void>;
  loadMenu: (slug: string) => Promise<void>;
}

const pendingMenus = new Set<string>();

export const useData = create<DataState>((set, get) => ({
  catalog: null,
  catalogFailed: false,
  menus: {},
  menuFailed: {},

  /** Draws from the static snapshot at once, then swaps in the live list when the API answers. */
  loadCatalog: async () => {
    set({ catalogFailed: false });
    let meta: Record<string, VenueMeta> = {};
    try {
      const snapshot = await (window.__catalog ?? fetch('data/catalog.json').then((r) => r.json()));
      window.__catalog = undefined;
      meta = snapshot.meta;
      set({ catalog: snapshot.catalog });
    } catch {
      // the live request below can still fill the screen
    }
    try {
      const live = await fetchRestaurants();
      set({ catalog: buildCatalog(live, meta) });
    } catch {
      if (!get().catalog) set({ catalogFailed: true });
    }
  },

  loadMenu: async (slug) => {
    if (!slug || get().menus[slug] || pendingMenus.has(slug)) return;
    pendingMenus.add(slug);
    set((s) => ({ menuFailed: { ...s.menuFailed, [slug]: false } }));
    try {
      const menu = buildMenu(await fetchMenu(slug));
      set((s) => ({ menus: { ...s.menus, [slug]: menu } }));
    } catch {
      set((s) => ({ menuFailed: { ...s.menuFailed, [slug]: true } }));
    } finally {
      pendingMenus.delete(slug);
    }
  },
}));

export function useMenu(slug: string) {
  const menu = useData((s) => s.menus[slug]) as Menu | undefined;
  const failed = useData((s) => !!s.menuFailed[slug]);
  const load = useData((s) => s.loadMenu);
  useEffect(() => {
    void load(slug);
  }, [slug, load]);
  return { menu, failed, retry: () => void load(slug) };
}

export const useChain = (id: string) => useData((s) => s.catalog?.find((c) => c.id === id));

export interface DishIndexRow {
  chain: string;
  slug: string;
  dishes: DishEntry[];
}

let dishIndex: Promise<DishIndexRow[]> | null = null;

/** The all-venues dish list is the one heavy file, so it loads only when someone searches. */
export function loadDishIndex() {
  dishIndex ??= fetch('data/dishes.json')
    .then((r) => r.json() as Promise<DishIndexRow[]>)
    .catch(() => {
      dishIndex = null;
      return [];
    });
  return dishIndex;
}
