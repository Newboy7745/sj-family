const C = 'sjf-v4';
self.addEventListener('install', e => e.waitUntil(
  caches.open(C).then(c => c.addAll(['./','./index.html','./manifest.json','./assets/icon-512.png']).catch(()=>{}))
));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))
));
self.addEventListener('fetch', e => {
  if(e.request.url.includes('firebase')||e.request.url.includes('googleapis')||e.request.url.includes('gstatic'))return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    if(res.ok){const rc=res.clone();caches.open(C).then(c=>c.put(e.request,rc));}
    return res;
  })));
});
