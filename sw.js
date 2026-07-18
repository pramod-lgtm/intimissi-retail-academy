const CACHE = 'ira-v13';
const CORE = [
  '/',
  '/index.html',
  '/styles.css',
  '/data.js',
  '/sales_data.js',
  '/jc_data.js',
  '/rules_data.js',
  '/app.js',
  '/manifest.json',
  '/icons/icon.svg'
];

// Install: cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for dashboard-data (live KPIs), cache-first for everything else
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Always fetch live data fresh from network
  if (url.includes('/dashboard-data.js') || url.includes('/refresh-data') || url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/dashboard-data.js'))
    );
    return;
  }

  // Cache-first for all other assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return resp;
      }).catch(() => {
        // Offline fallback
        if (e.request.destination === 'document') return caches.match('/index.html');
      });
    })
  );
});
