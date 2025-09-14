
// sw-cle-tiles.js
const VERSION = 'v1';
const TILE_CACHE = 'cle-tiles-' + VERSION;

// Match Esri basemap tile hosts we use (Imagery, Reference labels/roads, Streets)
const TILE_HOSTS = [
  'server.arcgisonline.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('cle-tiles-') && k !== TILE_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Cache-first fetch for tile requests (allows opaque responses for no-cors)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only intercept tile hosts; let other requests pass through
  if (!TILE_HOSTS.includes(url.hostname)) return;

  event.respondWith(
    caches.open(TILE_CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreVary: true, ignoreSearch: false });
      if (cached) return cached;

      try {
        const net = await fetch(req, { mode: 'no-cors' }); // opaque is fine for images
        // Put a clone into cache if possible
        try { cache.put(req, net.clone()); } catch(e) {}
        return net;
      } catch (e) {
        // On failure, still try to serve cache (may be null)
        return cached || Response.error();
      }
    })
  );
});

// Optional: prefetch/seed specific tile URLs sent from the page
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
          } catch (e) {
            // ignore single-tile failures
          }
        }
      })()
    );
  }
});
