import type { ApiItem, ApiMenu, ApiMenuEntry, ApiModifierGroup } from '../api/types';

export type SectionGroup = 'food' | 'drinks' | 'bar';
export const GROUP_NAMES: Record<SectionGroup, string> = { food: 'Еда', drinks: 'Напитки', bar: 'Бар' };
export const GROUP_ORDER: SectionGroup[] = ['food', 'drinks', 'bar'];

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  defaultQty: number;
}

export interface ModifierGroup {
  name: string;
  required: boolean;
  min: number;
  max: number;
  /** one: pick a single option. many: pick several. set: fixed contents of a combo. */
  kind: 'one' | 'many' | 'set';
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  volume: string | null;
  price: number;
  description: string;
  image: string | null;
  weight: number | null;
  noTakeaway: boolean;
  groups: ModifierGroup[];
}

export interface MenuSection {
  id: string;
  name: string;
  group: SectionGroup;
  promo: boolean;
  layout: 'grid' | 'rows';
  items: MenuItem[];
}

export interface Menu {
  slug: string;
  title: string;
  address: string;
  hours: string;
  description: string;
  payments: string[];
  canCallWaiter: boolean;
  canCallBill: boolean;
  canTakeaway: boolean;
  tables: number[];
  sections: MenuSection[];
}

const DRINK = /напит|кофе|чай|чаи|лимонад|сок|смузи|милкшейк|фреш|айс|матча|бабл|какао|вода|морс|компот|тоник|раф/;
const ALCOHOL = /пиво|вино|вина|коктейл|виски|водк|коньяк|ром\b|джин|текил|шампан|ликер|ликёр|аперитив|настойк|сидр|игрист|табач/;
const PROMO = /сет|новинк|сезон|осен/;

const capitalize = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1);

/** Kitchen systems shout: «КАПУЧИНО» reads better as «Капучино». */
function unshout(s: string) {
  const t = s.trim();
  return t.length > 3 && t === t.toUpperCase() ? capitalize(t.toLowerCase()) : t;
}

/** Splits a POS name into a guest-friendly name and a volume tag: «Капучино 0,3» → Капучино, 0,3 л. */
export function cleanName(raw: string): { name: string; volume: string | null } {
  let n = raw.replace(/\s*\(к\)/g, '').trim().replace(/^-\s*/, '');
  n = n.replace(/"\s*([^"]+?)\s*"/g, '«$1»');
  let volume: string | null = null;
  const vol = n.match(/\s*(\d+[.,]?\d*)\s*(мл|литр|л|L)(?![а-яa-z])\.?/);
  if (vol) {
    volume = `${vol[1].replace('.', ',')} ${vol[2] === 'мл' ? 'мл' : 'л'}`;
    n = (n.slice(0, vol.index) + n.slice(vol.index! + vol[0].length)).replace(/^[\s,]+|[\s,]+$/g, '');
  } else {
    const bare = n.match(/\s(0[.,]\d{1,3})$/);
    if (bare) {
      volume = `${bare[1].replace('.', ',')} л`;
      n = n.slice(0, bare.index).trim();
    }
  }
  return { name: capitalize(n.replace(/\s+/g, ' ').trim()), volume };
}

const GROUP_RENAMES: Record<string, string> = { Сиропа: 'Сироп', Молока: 'Молоко', Хлеба: 'Хлеб', Соуса: 'Соус' };

/** Some group names are really a dish or a section name and tell the guest nothing. */
function groupName(raw: string, dishy: Set<string>) {
  let n = cleanName(raw).name.replace(/^для\s+/i, '').replace(/\s*на выбор:?$/i, '').trim();
  n = capitalize(n);
  n = GROUP_RENAMES[n] ?? n;
  const low = n.toLowerCase();
  if (dishy.has(low) || low.endsWith(' мод') || low === 'блины и сырники') return 'Вариант';
  return unshout(n) || 'Добавки';
}

function mapGroup(g: ApiModifierGroup, dishy: Set<string>): ModifierGroup | null {
  if (g.link.is_deleted) return null;
  const options = g.members
    .filter((m) => !m.link.is_deleted && !m.item.is_deleted)
    .map((m) => ({
      id: m.item.id.slice(0, 8),
      name: cleanName(m.item.name).name,
      price: Math.round(Number(m.link.price_override ?? m.item.price ?? 0)),
      defaultQty: m.link.default_amount ?? 0,
    }));
  if (!options.length) return null;
  const min = g.link.min_amount ?? 0;
  const max = g.link.max_amount ?? 0;
  const kind = min === max && max === options.length && options.length > 1 ? 'set' : max === 1 ? 'one' : 'many';
  return { name: groupName(g.group.name, dishy), required: !!g.link.is_required || min > 0, min, max: max || 99, kind, options };
}

function mapItem(e: ApiMenuEntry, dishy: Set<string>): MenuItem {
  const it: ApiItem = e.item;
  const { name, volume } = cleanName(it.name);
  const weight = it.serving_size ?? 0;
  return {
    id: it.id.slice(0, 8),
    name,
    volume,
    price: Math.round(Number(it.price)),
    description: (it.description ?? '').trim(),
    image: it.images?.[0] ?? null,
    weight: weight > 0 && weight < 1000 && !volume ? weight : null,
    noTakeaway: !!it.hidden_for_takeaway,
    groups: (e.modifier_groups ?? []).map((g) => mapGroup(g, dishy)).filter((g): g is ModifierGroup => !!g),
  };
}

const isOrderable = (it: ApiItem) =>
  it.is_active !== false && it.is_available !== false && !it.is_service_item && !it.is_deleted;

/** Turns the raw POS menu into the structure the screens use. */
export function buildMenu(raw: ApiMenu): Menu {
  const r = raw.restaurant;
  const cats = raw.categories
    .filter((c) => c.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const dishy = new Set([
    ...raw.items.map((e) => cleanName(e.item.name).name.toLowerCase()),
    ...raw.categories.map((c) => c.name.toLowerCase()),
  ]);

  const byCategory = new Map<string, MenuItem[]>();
  for (const e of raw.items) {
    if (!isOrderable(e.item)) continue;
    const list = byCategory.get(e.item.category_id);
    if (list) list.push(mapItem(e, dishy));
    else byCategory.set(e.item.category_id, [mapItem(e, dishy)]);
  }

  const sections: MenuSection[] = [];
  for (const c of cats) {
    const items = byCategory.get(c.id);
    if (!items?.length) continue;
    const name = cleanName(unshout(c.name)).name.replace(/\s+(?:\d+\s*)?литр$/, '').trim();
    const low = c.name.toLowerCase();
    const group: SectionGroup = ALCOHOL.test(low) ? 'bar' : DRINK.test(low) ? 'drinks' : 'food';
    const twin = sections.find((s) => s.name === name && s.group === group); // «Лимонады 400 мл» + «Лимонады 1 литр»
    if (twin) twin.items.push(...items);
    else sections.push({ id: c.id.slice(0, 8), name, group, promo: PROMO.test(low) && group !== 'bar', layout: 'rows', items });
  }
  for (const s of sections) {
    s.layout = s.items.filter((i) => i.image).length / s.items.length >= 0.6 ? 'grid' : 'rows';
  }

  const description = (r.description ?? '').trim();
  const title = r.name.replace(/\s*\(?qr\)?(\s+k)?$/i, '').trim();
  return {
    slug: r.slug,
    title,
    address: (r.location ?? '').trim(),
    hours: (r.opening_hours ?? '').trim(),
    description: [title.toLowerCase(), r.name.trim().toLowerCase()].includes(description.toLowerCase()) ? '' : description,
    payments: raw.policy.payment_methods ?? [],
    canCallWaiter: !!r.service_features?.call_waiter_enabled,
    canCallBill: !!r.service_features?.call_bill_enabled,
    canTakeaway: (r.service_modes ?? []).includes('takeaway') && raw.policy.takeaway_enabled !== false,
    tables: [...new Set(raw.tables.filter((t) => t.is_active !== false).map((t) => t.table_number))].sort((a, b) => a - b),
    sections,
  };
}

/** [item id, name, price] for the cross-venue dish search. */
export type DishEntry = [string, string, number];

export function dishEntries(raw: ApiMenu): DishEntry[] {
  const cats = new Set(raw.categories.filter((c) => c.is_active !== false).map((c) => c.id));
  return raw.items
    .filter((e) => isOrderable(e.item) && cats.has(e.item.category_id))
    .map((e) => [e.item.id.slice(0, 8), cleanName(e.item.name).name, Math.round(Number(e.item.price))]);
}
