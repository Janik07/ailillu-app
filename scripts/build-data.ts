/**
 * Runs before each deploy. A venue's type, tags and real order modes are hidden
 * inside its menu, and the app should not download 160 menus to draw one list,
 * so this collects them once and ships two small static files.
 * Menus themselves stay live: the app fetches them when a guest opens a venue.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchMenu, fetchRestaurants } from '../src/api/client';
import { buildCatalog, isPublic, venueMeta, type VenueMeta } from '../src/domain/catalog';
import { dishEntries, type DishEntry } from '../src/domain/menu';

const CONCURRENCY = 3; // this is the production API, stay gentle

async function pool<T>(list: T[], run: (x: T) => Promise<void>) {
  let i = 0;
  const worker = async () => {
    while (i < list.length) await run(list[i++]);
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

const restaurants = await fetchRestaurants();
const candidates = restaurants.filter(isPublic);

const meta: Record<string, VenueMeta> = {};
const dishes: Record<string, DishEntry[]> = {};
let failed = 0;
await pool(candidates, async (r) => {
  try {
    const menu = await fetchMenu(r.slug);
    meta[r.slug] = venueMeta(r, menu);
    dishes[r.slug] = dishEntries(menu);
  } catch {
    failed += 1;
  }
});

const catalog = buildCatalog(restaurants, meta);

// Branches of a chain repeat one menu, so the search index keeps the largest one.
const search = catalog.map((chain) => {
  const slug = chain.branches.map((b) => b.slug).sort((a, b) => (dishes[b]?.length ?? 0) - (dishes[a]?.length ?? 0))[0];
  const unique = new Map((dishes[slug] ?? []).map((d) => [d[1].toLowerCase(), d]));
  return { chain: chain.id, slug, dishes: [...unique.values()] };
});

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/catalog.json', JSON.stringify({ builtAt: new Date().toISOString(), meta, catalog }));
writeFileSync('public/data/dishes.json', JSON.stringify(search));

const places = catalog.reduce((a, c) => a + c.branches.length, 0);
console.log(`menus ${candidates.length - failed}/${candidates.length}, chains ${catalog.length}, places ${places}`);
