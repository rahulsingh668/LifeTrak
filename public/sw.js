const CACHE = 'lifetrak-v1';
const ASSETS = ['/', '/src/style.css', '/src/data.js', '/src/api.js', '/src/store.js', '/src/render.js', '/src/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { caches.open(CACHE).then(ca => ca.put(e.request, r.clone())); return r; })));
});
