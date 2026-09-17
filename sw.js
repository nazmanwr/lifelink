/* Service worker: makes RoktoDaan installable and usable on a bad connection.
 *
 * Strategy is network-first for our own files, falling back to cache. That
 * ordering matters: cache-first would pin people to an old copy of the app
 * after a deploy, and a blood app quietly running stale matching logic is
 * worse than one that loads a second slower.
 *
 * Firebase traffic is never touched. Auth tokens and Firestore reads must
 * always hit the network, and the SDK does its own offline handling.
 */

const VERSION = 'roktodaan-v1';

/* The shell needed to render something useful with no connection. */
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/blood.js',
  './js/geo.js',
  './js/store.js',
  './js/match.js',
  './js/seed.js',
  './js/backend.js',
  './js/ui.js',
  './js/views.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      /* One missing file must not fail the whole install, so add individually. */
      .then((cache) => Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isOurs(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  /* Firebase, Google APIs and the SDK CDN go straight to the network. */
  if (!isOurs(url)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => {
        if (hit) return hit;
        /* An unknown page offline still gets the app shell, so the
           hash router can take over instead of showing a browser error. */
        if (request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }))
  );
});
