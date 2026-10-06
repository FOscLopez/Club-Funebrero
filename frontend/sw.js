const CACHE_NAME = 'funebrero-pwa-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/logo-funebrero_2.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  // Ignorar archivos de video y audio para que el ServiceWorker no los bloquee
  if (event.request.url.endsWith('.mp3') || event.request.url.endsWith('.mp4')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});