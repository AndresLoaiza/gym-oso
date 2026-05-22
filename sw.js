const CACHE = 'oso-gym-v31';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './catalogo-imgs.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('anthropic.com')) return; // no cache de API
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchP = fetch(req).then((res) => {
        if (res && res.status === 200 && (url.origin === location.origin || req.destination === 'font' || url.hostname.includes('googleapis') || url.hostname.includes('gstatic') || url.hostname.includes('jsdelivr'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchP;
    })
  );
});
