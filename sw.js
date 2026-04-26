const CACHE = 'journaly-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/global.css',
  './css/home.css',
  './css/history.css',
  './css/progression.css',
  './css/profile.css',
  './js/db.js',
  './js/app.js',
  './js/home.js',
  './js/history.js',
  './js/progression.js',
  './js/profile.js',
  './assets/icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      /* If the app is already open, just focus it */
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      /* Otherwise open a new window */
      return clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
