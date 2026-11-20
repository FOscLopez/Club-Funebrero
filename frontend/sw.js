const CACHE_NAME = 'funebrero-pwa-v3';
const ASSETS_TO_CACHE = [
  '/logo-funebrero_2.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Solo manejar peticiones GET del mismo origen; ignorar APIs externas, Firebase y multimedia
  if (
    event.request.method !== 'GET' ||
    !url.startsWith(self.location.origin) ||
    url.endsWith('.mp3') ||
    url.endsWith('.mp4')
  ) {
    return;
  }

  // Estrategia Network-First: siempre busca la versión más reciente y segura
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});