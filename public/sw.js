self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('estudo-divertido-cache').then((cache) => {
      return cache.addAll([
        '/',
        '/offline',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/offline');
        }
        return null;
      });
    })
  );
});
