self.addEventListener('install', event => event.waitUntil(caches.open('mylingua-v1').then(cache => cache.addAll(['/','/manifest.webmanifest']))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== 'mylingua-v1').map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then(async cached => {
    if (event.request.mode === 'navigate') {
      try {
        const fresh = await fetch(event.request);
        if (fresh.ok) (await caches.open('mylingua-v1')).put(event.request, fresh.clone());
        return fresh;
      } catch {
        return cached || caches.match('/');
      }
    }
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && new URL(event.request.url).pathname.startsWith('/assets/')) {
      const cache = await caches.open('mylingua-v1');
      cache.put(event.request, response.clone());
    }
    return response;
  }).catch(() => caches.match('/')));
});
