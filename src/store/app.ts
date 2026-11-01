import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Point } from '../domain/geo';
import type { Menu, MenuItem } from '../domain/menu';
import { selectionText, unitPrice, type Selection } from '../domain/modifiers';

export type OrderMode = 'table' | 'takeaway';
export type Theme = 'auto' | 'light' | 'dark';

export interface CartLine {
  itemId: string;
  name: string;
  volume: string | null;
  image: string | null;
  mods: string;
  price: number;
  qty: number;
}

export interface Cart {
  slug: string;
  title: string;
  mode: OrderMode;
  table: number | null;
  lines: CartLine[];
}

export interface Order {
  no: number;
  slug: string;
  title: string;
  table: number | null;
  paid: boolean;
  time: string;
  lines: CartLine[];
  total: number;
}

export interface Note {
  text: string;
  sub?: string;
  image?: string | null;
  action?: { label: string; run: () => void };
}

export const cartTotal = (lines: CartLine[]) => lines.reduce((a, l) => a + l.price * l.qty, 0);
export const cartCount = (lines: CartLine[]) => lines.reduce((a, l) => a + l.qty, 0);

interface AppState {
  city: string;
  cart: Cart | null;
  orders: Order[];
  phone: string;
  visited: string[];
  favorites: string[];
  theme: Theme;
  me: Point | null;
  note: Note | null;
  /** The section picked in the «Всё меню» sheet, picked up by the menu underneath. */
  jump: { slug: string; section: string } | null;

  setJump: (slug: string, section: string) => void;
  clearJump: () => void;
  setCity: (city: string) => void;
  setPhone: (phone: string) => void;
  setTheme: (theme: Theme) => void;
  visit: (chainId: string) => void;
  toggleFavorite: (chainId: string) => void;
  addToCart: (menu: Menu, item: MenuItem, sel: Selection, qty: number, mode: OrderMode, table: number | null) => void;
  setLineQty: (index: number, qty: number) => void;
  setCartMode: (mode: OrderMode, table?: number | null) => void;
  clearCart: () => void;
  addOrder: (order: Order) => void;
  locate: () => Promise<Point | null>;
  toast: (note: Note) => void;
  dismissToast: () => void;
  resetAll: () => void;
}

let toastTimer: ReturnType<typeof setTimeout>;

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      city: 'Астана',
      cart: null,
      orders: [],
      phone: '',
      visited: [],
      favorites: [],
      theme: 'auto',
      me: null,
      note: null,
      jump: null,

      setJump: (slug, section) => set({ jump: { slug, section } }),
      clearJump: () => set({ jump: null }),
      setCity: (city) => set({ city }),
      setPhone: (phone) => set({ phone }),
      setTheme: (theme) => set({ theme }),
      visit: (id) => set((s) => ({ visited: [id, ...s.visited.filter((x) => x !== id)].slice(0, 6) })),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id],
        })),

      addToCart: (menu, item, sel, qty, mode, table) => {
        const prev = get().cart;
        const base: Cart =
          prev && prev.slug === menu.slug ? prev : { slug: menu.slug, title: menu.title, mode, table, lines: [] };
        const line: CartLine = {
          itemId: item.id,
          name: item.name,
          volume: item.volume,
          image: item.image,
          mods: selectionText(item, sel),
          price: unitPrice(item, sel),
          qty,
        };
        const same = base.lines.findIndex((l) => l.itemId === line.itemId && l.mods === line.mods);
        const lines =
          same >= 0
            ? base.lines.map((l, i) => (i === same ? { ...l, qty: l.qty + qty } : l))
            : [...base.lines, line];
        set({ cart: { ...base, lines } });
      },

      setLineQty: (index, qty) => {
        const cart = get().cart;
        if (!cart) return;
        const lines =
          qty <= 0 ? cart.lines.filter((_, i) => i !== index) : cart.lines.map((l, i) => (i === index ? { ...l, qty } : l));
        set({ cart: lines.length ? { ...cart, lines } : null });
      },

      setCartMode: (mode, table) => {
        const cart = get().cart;
        if (cart) set({ cart: { ...cart, mode, table: table === undefined ? cart.table : table } });
      },

      clearCart: () => set({ cart: null }),
      addOrder: (order) => set((s) => ({ orders: [order, ...s.orders], cart: null })),

      /** Asked only after the guest taps a location button, never on start. */
      locate: () =>
        new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (p) => {
              const me = { lat: p.coords.latitude, lon: p.coords.longitude };
              set({ me });
              resolve(me);
            },
            () => {
              get().toast({ text: 'Не удалось определить место', sub: 'Разрешите доступ к геолокации в браузере' });
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
          );
        }),

      toast: (note) => {
        set({ note });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ note: null }), 3200);
      },
      dismissToast: () => set({ note: null }),

      resetAll: () => set({ cart: null, orders: [], phone: '', visited: [], favorites: [], me: null }),
    }),
    {
      name: 'ailillu-app',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ city, cart, orders, phone, visited, favorites, theme }) => ({
        city,
        cart,
        orders,
        phone,
        visited,
        favorites,
        theme,
      }),
    },
  ),
);
