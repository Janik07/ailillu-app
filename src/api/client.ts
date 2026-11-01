import type { ApiMenu, ApiRestaurant } from './types';

const API = 'https://ailillu.kz/api/v0';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

export const fetchRestaurants = () => json<ApiRestaurant[]>(`${API}/restaurants`);

/** POST here only reads: the endpoint returns the full menu, policy and tables of one venue. */
export const fetchMenu = (slug: string) =>
  json<ApiMenu>(`${API}/restaurants/modifiers/${encodeURIComponent(slug)}`, { method: 'POST' });

export type MediaBase = 'restaurant' | 'dalle';

/** The API resizes images only to these widths, anything else answers 400. */
export type MediaWidth = 320 | 640;

export const mediaUrl = (base: MediaBase, path: string, width: MediaWidth) =>
  `${API}/restaurants/media?base=${base}&path=${encodeURIComponent(path)}&width=${width}`;
