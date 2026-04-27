// Service Worker for Field Sampler PWA
const CACHE_NAME = 'field-sampler-v1';
const ASSETS = [
  '/field-sampling-app/',
  '/field-sampling-app/index.html',
  '/field-sampling-app/css/style.css',
  '/field-sampling-app/js/app.js',
  '/field-sampling-app/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => cached);
    })
  );
});
