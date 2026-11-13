/* Repéré — service worker (docs/13-app-spec.md §8).
 * - App shell (page hors ligne, icônes, /_next/static/*) : cache-first, précache à l'install.
 * - Navigations /app/* : network-first (timeout 3 s), repli sur le cache puis /app/hors-ligne.
 * - /api/* GET (lectures) : network-first, repli sur la dernière réponse en cache.
 * - /api/* non-GET (POST/PATCH, auth, webhooks, Stripe) : jamais interceptés ni mis en cache.
 * - Images : stale-while-revalidate, plafond 50 entrées.
 * Autres origines (Supabase, Stripe) : réseau direct.
 */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const API = `api-${VERSION}`;
const IMAGES = `img-${VERSION}`;
const OFFLINE_URL = '/app/hors-ligne';
const SHELL_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon-180.png',
];
const NAV_TIMEOUT_MS = 3000;
const MAX_IMAGES = 50;
const MAX_PAGES = 30;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) =>
      // addAll échoue en bloc : on précache une par une pour tolérer une icône absente.
      Promise.all(SHELL_URLS.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => undefined))),
    ),
  );
  // Pas de skipWaiting automatique : l'app propose « Mettre à jour ».
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL, PAGES, API, IMAGES];
      for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_PRIVATE') {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(API)]));
  }
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    const copy = res.clone();
    caches.open(SHELL).then((c) => c.put(req, copy));
  }
  return res;
}

async function networkFirstPage(event) {
  const req = event.request;
  const url = new URL(req.url);
  const isApp = url.pathname === '/app' || url.pathname.startsWith('/app/');
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const res = preload || (await withTimeout(fetch(req), NAV_TIMEOUT_MS));
    if (isApp && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, MAX_PAGES));
    }
    return res;
  } catch {
    const cached = (await caches.match(req, { ignoreSearch: true })) || (isApp ? await caches.match('/app') : null);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function networkFirstApi(req) {
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic' && (res.headers.get('content-type') || '').includes('application/json')) {
      const copy = res.clone();
      caches.open(API).then((c) => c.put(req, copy));
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

async function staleWhileRevalidate(event) {
  const req = event.request;
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).then(() => trim(IMAGES, MAX_IMAGES));
      return res;
    })
    .catch(() => hit);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return refresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST/PATCH (/api/actions, checkout, auth) : réseau direct
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Stripe, polices externes : réseau direct

  const p = url.pathname;

  if (p.startsWith('/api/')) {
    // Webhooks, cron, auth et PDF : jamais en cache.
    if (/^\/api\/(stripe|cron|auth|checkout|report)\b/.test(p)) return;
    event.respondWith(networkFirstApi(req));
    return;
  }

  if (p.startsWith('/_next/static/') || p.startsWith('/icons/') || p === '/manifest.webmanifest' || p === OFFLINE_URL) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(event));
    return;
  }

  if (req.destination === 'image') {
    event.respondWith(staleWhileRevalidate(event));
  }
});

// Web push : payload JSON { title, body, url, tag }. iOS exige une notification visible pour chaque push.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Repéré', {
      body: d.body || '',
      tag: d.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: d.url || '/app' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          await c.focus();
          if ('navigate' in c) return c.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
