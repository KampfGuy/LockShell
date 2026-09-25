/* ShellOS (LockShell) service worker: cache-first for local assets, network-first for Open-Meteo.
   YouTube, Wikipedia and kid sites are cross-origin and never cached. */
const VERSION = 'lockshell-v1.3.0';
const ASSETS = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/core.js', 'js/shell-filter.js', 'js/buddy-brain.js', 'js/buddy.js', 'js/voice.js', 'js/camera.js', 'js/recorder.js', 'js/notes.js',
  'js/weather.js', 'js/games.js', 'js/games2.js', 'js/games3.js', 'js/tools.js', 'js/apps2.js', 'js/shell.js',
  'js/yt-library.js', 'js/youtube.js', 'js/photos.js', 'js/stories-data.js', 'js/stories.js', 'js/quiz-data.js', 'js/quiz.js',
  'js/settings.js', 'js/dev.js', 'js/screentime.js', 'js/boot.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('lockshell-') && k !== VERSION && k !== VERSION + '-wx').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/(^|\.)open-meteo\.com$/.test(url.hostname)) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION + '-wx').then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
