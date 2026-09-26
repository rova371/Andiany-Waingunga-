// Service worker minimal : met en cache les fichiers de l'app (HTML/CSS/JS)
// pour qu'elle puisse s'ouvrir hors connexion. Les échanges avec Firebase
// (calendrier, discussion, suivi...) ne sont JAMAIS interceptés ici : c'est
// Firestore lui-même qui gère son propre cache hors-ligne et l'envoi des
// messages en attente dès que le réseau revient (activé dans
// firebase-config.js). C'est ce qui permettait déjà d'écrire des messages
// hors connexion tant que l'app était restée ouverte.

const CACHE_NAME = 'andiany-mamikely-v4';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .catch((err) => console.warn('Mise en cache initiale incomplète :', err))
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
  const url = event.request.url;
  // Tout ce qui touche Firebase/Google (données en direct, authentification,
  // scripts du SDK) part directement au réseau, sans jamais passer par notre
  // cache : c'est Firestore qui s'occupe de son propre fonctionnement
  // hors-ligne, on ne doit pas s'en mêler.
  if(url.includes('googleapis.com') || url.includes('gstatic.com') || url.includes('firebaseio.com') || url.includes('google.com')){
    return;
  }
  // Seule la coquille de l'app (HTML/CSS/JS/logo) est servie depuis le cache.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match('./index.html')))
  );
});
