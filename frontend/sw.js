const CACHE_NAME = 'funebrero-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/logo-funebrero_2.png'
];

// Instala el Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Responde a las peticiones (permite que la app abra rápido)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});