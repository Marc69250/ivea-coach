// Service worker : permet à Ivea Coach de fonctionner hors-ligne une fois
// ouverte au moins une fois (toutes les données restent en localStorage,
// ce cache ne concerne que le code de l'app).

const CACHE_NAME = 'ivea-coach-v2';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/router.js',
  './js/store.js',
  './js/config.js',
  './js/utils.js',
  './js/ui.js',
  './js/sync.js',
  './js/sync-ui.js',
  './js/views/dashboard.js',
  './js/views/pipeline.js',
  './js/views/contacts.js',
  './js/views/followups.js',
  './js/views/settings.js',
  './js/views/followup-editor.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
