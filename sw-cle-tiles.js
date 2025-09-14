// sw-cle-tiles.js
const VERSION = 'v1';
const TILE_CACHE = 'cle-tiles-' + VERSION;
const TILE_HOSTS = ['server.arcgisonline.com'];

self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('cle-tiles-') && k !== TILE_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (!TILE_HOSTS.includes(url.hostname)) return;
  event.respondWith(
    caches.open(TILE_CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreVary: true, ignoreSearch: false });
      if (cached) return cached;
      try {
        const net = await fetch(req, { mode: 'no-cors' });
        try { cache.put(req, net.clone()); } catch(e) {}
        return net;
      } catch (e) {
        return cached || Response.error();
      }
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'seedTiles' && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(TILE_CACHE);
        for (const u of data.urls) {
          try {
            const req = new Request(u, { mode: 'no-cors', cache: 'reload' });
            const res = await fetch(req);
            try { await cache.put(req, res.clone()); } catch(e) {}
          } catch (e) {}
        }
      })()
    );
  }
});
