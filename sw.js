// Service worker minimal : met en cache les fichiers de l'app (HTML/CSS/JS)
// pour qu'elle puisse s'ouvrir hors connexion. Les données (calendrier,
// discussion) sont gérées séparément par le cache hors-ligne de Firestore
// (activé dans firebase-config.js).

const CACHE_NAME = 'andiany-mamikely-v1';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
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
  // Ne touche pas aux appels vers Firebase/Google (données en direct) :
  // seulement la coquille de l'app est mise en cache.
  if(event.request.url.includes('googleapis.com') || event.request.url.includes('firebaseio.com') || event.request.url.includes('gstatic.com')){
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match('./index.html')))
  );
});
