/*! Getclient service worker.
 *  CACHE carries a build hash injected at build time, so every deploy creates a
 *  new cache and the old one is deleted on activate. This is what stops a stale
 *  app.js or live.js being pinned on a returning visitor's machine.
 */
const BUILD = 'f120148897';
const CACHE = 'getclient-' + BUILD;
const SHELL = ['/offline.html', '/logo.png', '/manifest.webmanifest', '/assets/brand/logo.svg', '/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // never cache the database, the reviewer panel, or verification records
  if (url.hostname.endsWith('supabase.co') ||
      url.pathname.startsWith('/admin') ||
      url.pathname.startsWith('/verify/') ||
      url.pathname === '/config.js') return;

  // Code and pages: network first. A cached copy is only ever a fallback for
  // being offline, never the reason someone runs last week's JavaScript.
  const isCode = /\.(js|css)$/.test(url.pathname);
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isCode || isPage) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('/offline.html')))
    );
    return;
  }

  // Images and fonts are content-addressed enough to serve from cache first.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
