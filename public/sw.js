// v2 — network-first: нові деплої підхоплюються автоматично, кеш лише як офлайн-запас.
const CACHE_NAME = 'euroclub-v2';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Тільки свій домен; API/Worker йдуть напряму в мережу
  if (url.origin !== self.location.origin) return;

  // Network-first: завжди пробуємо свіже з мережі, кеш — запас для офлайну
  event.respondWith(
    fetch(req).then((response) => {
      if (response && response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
      }
      return response;
    }).catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
  );
});
