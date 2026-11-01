/*
 * Makes repeat visits instant. GitHub Pages caches files for only 10 minutes, so
 * without this a returning guest would re-check every file over the network.
 * Hashed files in assets/ never change; everything else is refreshed in the
 * background and the page itself is network-first, so a deploy shows up at once.
 *
 * This file must never be able to break the app: any cache failure falls back
 * to a plain network request.
 */
const CACHE = 'ailillu-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function remember(cache, request, res) {
  if (res.ok) cache.put(request, res.clone()).catch(() => {});
  return res;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  return hit ?? remember(cache, request, await fetch(request));
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const update = fetch(request).then((res) => remember(cache, request, res));
  if (!hit) return update;
  update.catch(() => {});
  return hit;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    return remember(cache, request, await fetch(request));
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  let strategy = staleWhileRevalidate;
  if (request.mode === 'navigate') strategy = networkFirst;
  else if (url.pathname.includes('/assets/')) strategy = cacheFirst;
  event.respondWith(strategy(request).catch(() => fetch(request)));
});
