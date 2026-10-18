/* Minimal offline support: cache the app shell, serve from cache, refresh in the background.
   Bump CACHE whenever you change any file so phones pick up the new version. */
var CACHE = 'goose-pond-v16';
var ASSETS = ['./', 'index.html', 'style.css', 'game.js', 'sprites.js', 'goodies.js', 'lines.js', 'forest.js', 'hut.js', 'config.js', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req.mode === 'navigate' ? 'index.html' : req, res.clone());
          return res;
        }).catch(function () { return hit || cache.match('index.html'); });
        return hit || net;
      });
    })
  );
});
