const CACHE = 'lifetrak-v13';
const V='13';
const ASSETS = ['/app','/app/','/manifest.json'].concat(['style.css','data.js','api.js','store.js','render.js','app.js'].map(f=>`/src/${f}?v=${V}`));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Same-origin only. Cross-origin (e.g. exchange-rate API) must never be
  // cache-first here — it froze the first FX response forever.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  if (e.request.method !== 'GET') return;

  // HTML/navigations: network-first so deploys reach users without a
  // cache-name bump; fall back to cache when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => { if (r.ok) caches.open(CACHE).then(c=>c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request).then(c => c || caches.match('/app')))
    );
    return;
  }

  // Static assets: stale-while-revalidate. Serve cache instantly, refresh in
  // the background, and only cache successful basic responses.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const refresh = fetch(e.request).then(r => {
        if (r.ok && r.type === 'basic') caches.open(CACHE).then(c=>c.put(e.request, r.clone()));
        return r;
      }).catch(() => cached);
      return cached || refresh;
    })
  );
});

self.addEventListener('sync', e => {
  if (e.tag === 'sync-expenses') e.waitUntil(self.clients.matchAll().then(cs=>cs.forEach(c=>c.postMessage({type:'SYNC_EXPENSES'}))));
});
self.addEventListener('message', e => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
