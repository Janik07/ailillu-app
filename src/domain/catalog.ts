import type { ApiMenu, ApiRestaurant } from '../api/types';
import type { Point } from './geo';

export type Mode = 'table' | 'takeaway' | 'delivery';

/** What only the menus can tell. scripts/build-data.ts collects it once per deploy. */
export interface VenueMeta {
  type: string;
  tags: string[];
  modes: Mode[];
  items: number;
}

export interface Branch extends Partial<Point> {
  name: string;
  short: string;
  address: string;
  hours: string;
  modes: Mode[];
  /** Copy of the venue the guest orders from, see pickMain(). */
  slug: string;
  photo: string | null;
}

export interface Chain {
  id: string;
  title: string;
  type: string;
  check: number;
  photo: string | null;
  city: string;
  modes: Mode[];
  tags: string[];
  branches: Branch[];
}

/** Many venues share this default instead of a real location. */
const PLACEHOLDER_POINT = { lat: 51.1694, lon: 71.4491 };

const CITIES: [string, RegExp][] = [
  ['Алматы', /алмат|almaty|алма-ат/],
  ['Шымкент', /шымкент|shymkent/],
  ['Актау', /актау|aktau/],
  ['Актобе', /актобе/],
  ['Караганда', /караганд|krg/],
  ['Кокшетау', /кокшетау/],
  ['Тараз', /тараз/],
  ['Ташкент', /ташкент|\buz\b/],
  ['Семей', /семей/],
  ['Кызылорда', /кызылорда/],
  ['Туркестан', /город туркестан|г\.\s*туркестан/],
  ['Костанай', /костанай|kostanay/],
];

function cityOf(r: ApiRestaurant) {
  const text = [r.name, r.location, r.slug].filter(Boolean).join(' ').toLowerCase();
  return CITIES.find(([, rx]) => rx.test(text))?.[0] ?? 'Астана';
}

/** One place often exists as several copies: «Saya», «Saya QR», «Saya Доставка», «Saya Kiosk». */
function stripChannel(name: string) {
  return name
    .replace(/\s*\(qr\)/i, '')
    .replace(/\s+qr(?:\s+k)?(?=\s|$)/i, '')
    .replace(/\s+(?:kiosk|киоск|доставка)(?=\s|$)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Generic first words that would otherwise glue unrelated brands together. */
const GENERIC_FIRST_WORD = /^(coffee|cafe|кафе|кофейня|ресторан|бар|restaurant|the)$/;

function chainKey(name: string) {
  const words = stripChannel(name).toLowerCase().split(/[\s-]+/);
  return GENERIC_FIRST_WORD.test(words[0]) && words[1] ? `${words[0]} ${words[1]}` : words[0];
}

function commonPrefix(names: string[]) {
  const split = names.map((n) => n.split(' '));
  const out: string[] = [];
  for (let i = 0; i < split[0].length; i++) {
    const w = split[0][i].toLowerCase();
    if (!split.every((s) => s[i]?.toLowerCase() === w)) break;
    out.push(split[0][i]);
  }
  return out.join(' ');
}

function cleanAddress(location: string | null) {
  return (location ?? '')
    .replace(/​/g, '')
    .replace(/^\s*(?:Адрес:\s*)?(?:г\.\s?)?(?:Астана|Astana)[,;\s]*/, '')
    .replace(/^[\s,;]+|[\s,;]+$/g, '');
}

function pointOf(r: ApiRestaurant): Point | null {
  if (!r.latitude || !r.longitude) return null;
  const p = { lat: Number(r.latitude), lon: Number(r.longitude) };
  const placeholder =
    Math.abs(p.lat - PLACEHOLDER_POINT.lat) < 1e-3 && Math.abs(p.lon - PLACEHOLDER_POINT.lon) < 1e-3;
  return placeholder ? null : p;
}

/** QR copies carry the tables and the dine-in menu, so guests should land there. */
function pickMain(copies: ApiRestaurant[]) {
  const score = (r: ApiRestaurant) => {
    if (/(^|\s)\(?qr\)?(\s|$)/i.test(r.name) || /-qr(-|$)/.test(r.slug)) return 0;
    if (/kiosk|киоск/i.test(r.name)) return 3;
    if (/доставка/i.test(r.name)) return 2;
    return 1;
  };
  return [...copies].sort((a, b) => score(a) - score(b))[0];
}

export const isPublic = (r: ApiRestaurant) =>
  !r.is_draft && r.accepts_orders && r.is_visible_in_public_list && !/demo|test|тест|демо/i.test(r.name + r.slug);

function apiModes(r: ApiRestaurant): Mode[] {
  const on = new Set(r.service_modes ?? []);
  const modes: Mode[] = [];
  if (on.has('dine_in')) modes.push('table');
  if (on.has('takeaway')) modes.push('takeaway');
  if (on.has('delivery')) modes.push('delivery');
  return modes;
}

const MODE_ORDER: Mode[] = ['table', 'takeaway', 'delivery'];
const unionModes = (lists: Mode[][]) => MODE_ORDER.filter((m) => lists.some((l) => l.includes(m)));

/** Turns the flat API list into what a guest thinks of: brands with their branches. */
export function buildCatalog(all: ApiRestaurant[], meta: Record<string, VenueMeta>): Chain[] {
  const live = all.filter(isPublic).filter((r) => (meta[r.slug]?.items ?? 1) > 0);

  const places = new Map<string, ApiRestaurant[]>();
  for (const r of live) {
    const key = `${cityOf(r)}|${stripChannel(r.name).toLowerCase()}`;
    places.set(key, [...(places.get(key) ?? []), r]);
  }

  const chains = new Map<string, ApiRestaurant[][]>();
  for (const copies of places.values()) {
    const key = `${cityOf(copies[0])}|${chainKey(copies[0].name)}`;
    chains.set(key, [...(chains.get(key) ?? []), copies]);
  }

  const out: Chain[] = [];
  for (const [id, group] of chains) {
    const names = group.map((copies) => stripChannel(copies[0].name));
    const prefix = group.length > 1 ? commonPrefix(names) : names[0];
    const raw = prefix.length >= 2 ? prefix : names[0];
    const shouting = raw.length > 3 && raw === raw.toUpperCase() && /[А-Я]/.test(raw);
    const title = shouting ? raw[0] + raw.slice(1).toLowerCase() : raw; // «ХОТТАБЫЧ» → «Хоттабыч»

    const branches: Branch[] = group
      .map((copies) => {
        const main = pickMain(copies);
        const located = copies.find((r) => pointOf(r)) ?? main;
        const name = stripChannel(main.name);
        return {
          name,
          short: group.length > 1 ? name.slice(title.length).replace(/^[\s·-]+/, '') || name : name,
          address: cleanAddress(main.location ?? located.location) || '—',
          hours: (main.opening_hours ?? '').trim(),
          modes: unionModes(copies.map((r) => meta[r.slug]?.modes ?? apiModes(r))),
          slug: main.slug,
          photo: copies.find((r) => r.images?.length)?.images?.[0] ?? null,
          ...(pointOf(located) ?? {}),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    const metas = group.flat().map((r) => meta[r.slug]).filter(Boolean);
    out.push({
      id: id.replace(/\s+/g, '-'),
      title,
      type: metas[0]?.type ?? 'Кафе и ресторан',
      check: Math.round(Number(group[0][0].average_check ?? 0)),
      photo: branches.find((b) => b.photo)?.photo ?? null,
      city: cityOf(group[0][0]),
      modes: unionModes(branches.map((b) => b.modes)),
      tags: [...new Set(metas.flatMap((m) => m.tags))],
      branches,
    });
  }
  return out.sort((a, b) => b.branches.length - a.branches.length || a.title.localeCompare(b.title, 'ru'));
}

const THEMES: Record<string, RegExp> = {
  coffee: /кофе|капучино|латте|раф\b|эспрессо|американо|флэт|матча|какао|coffee|cappuccino|latte/,
  alcohol: /пиво|вино|коктейл|виски|водк|коньяк|ром\b|джин|текил|шампан|настойк|beer|wine|cocktail/,
  sushi: /суши|ролл|сашими|нигири|гункан|sushi|roll/,
  pizza: /пицц|pizza/,
  doner: /донер|денер|шаурм|бургер|burger|хот-?дог|doner|лаваш/,
  national: /плов|бешбармак|манты|лагман|самса|баурсак|казы|шашлык|кебаб|тандыр/,
};
const FOOD_TYPES: Record<string, string> = {
  sushi: 'Суши',
  pizza: 'Пицца',
  doner: 'Донеры и бургеры',
  national: 'Национальная кухня',
};

const TAGS: [string, RegExp][] = [
  ['breakfast', /завтрак/],
  ['bar', /пиво|вино|коктейл|виски|водк|коньяк/],
  ['sushi', /суши|ролл/],
  ['doner', /донер|денер|бургер|шаурм/],
];

/** Reads a venue's type, tags and real order modes out of its menu. */
export function venueMeta(r: ApiRestaurant, menu: ApiMenu): VenueMeta {
  const cats = new Map(menu.categories.filter((c) => c.is_active !== false).map((c) => [c.id, c.name]));
  const items = menu.items
    .map((e) => e.item)
    .filter((it) => it.is_active !== false && !it.is_service_item && cats.has(it.category_id));

  const n = items.length || 1;
  const share = (rx: RegExp) =>
    items.filter((it) => rx.test(`${it.name} ${cats.get(it.category_id)}`.toLowerCase())).length / n;
  const shares = Object.fromEntries(Object.entries(THEMES).map(([k, rx]) => [k, share(rx)]));

  const food = Object.keys(FOOD_TYPES).sort((a, b) => shares[b] - shares[a])[0];
  let type = 'Кафе и ресторан';
  if (shares.coffee >= 0.3 && items.length <= 220) type = 'Кофейня';
  else if (shares[food] >= 0.25) type = FOOD_TYPES[food];
  if (shares.alcohol >= 0.2) type = type === 'Кафе и ресторан' ? 'Бар и ресторан' : `${type} и бар`;

  const catText = [...cats.values()].join(' ').toLowerCase();
  const modes = apiModes(r).filter((m) => {
    if (m === 'takeaway') return menu.policy.takeaway_enabled !== false;
    if (m === 'delivery') return menu.policy.delivery_enabled === true;
    return true;
  });
  return { type, tags: TAGS.filter(([, rx]) => rx.test(catText)).map(([t]) => t), modes, items: items.length };
}
