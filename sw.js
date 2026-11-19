/* OlamDev MCB201 - service worker (offline support) */
var CACHE = 'olamdev-mcb201-v1';
var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'questions.js', 'supabase-config.js', 'admin.html', 'admin.js', 'manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }))
      .then(function () { return fetch(CDN, { mode: 'no-cors' }).then(function (r) { return c.put(CDN, r); }).catch(function () {}); });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.pathname.indexOf('/api/') === 0 || url.hostname.indexOf('supabase.co') > -1) return; // always live
  if (url.pathname.slice(-15) === 'config.local.js') return;
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined);
      });
      return hit || net;
    })
  );
});
