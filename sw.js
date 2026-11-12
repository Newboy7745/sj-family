// SJ Family — service worker : réseau d'abord (toujours la dernière version), cache en secours hors-ligne
const CACHE = 'sjfamily-v6.17';
const SHELL = ['./', './index.html', './app.css', './app.js', './core.js', './engine.js', './ui.js', './backend.js', './sj-data.js',
  './views-home.js', './views-agenda.js', './views-planning.js', './views-exchange.js', './views-family.js', './views-budget.js', './views-more.js', './views-admin.js', './install.js', './views-sac.js', './sac-export.js', './print.js',
  './logo-top.png', './logo-full.png', './icon-192.png', './favicon.png', './manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Firebase / Google APIs : jamais interceptés
  if (/googleapis\.com|firebaseio|firebaseapp|identitytoolkit|securetoken|ntfy\.sh|github\.com/.test(url.host)) return;
  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin || /gstatic\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/.test(url.host);
  if (!cacheable) return;
  e.respondWith((async () => {
    if (sameOrigin) {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
        return res;
      } catch (err) {
        const hit = await caches.match(req, { ignoreSearch: true });
        return hit || caches.match('./index.html');
      }
    }
    // bibliothèques & polices (versionnées) : cache d'abord
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  })());
});
