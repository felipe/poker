// Service worker for offline-first behavior.
//
// Strategy: cache-first for everything. The asset URLs in index.html carry a
// ?v=N query string; bumping that version bumps ASSET_VERSION here too, the
// cache name changes, and the install step re-fetches the new versions.
// Cross-origin requests, non-GET, and anything else falls through to the
// network unaltered.

const ASSET_VERSION = "6";
const CACHE_NAME = `poker-v${ASSET_VERSION}`;

// The shell + the modules + the eight themes. Fonts (themes/fonts/*.woff2)
// and font bundle CSS get cached on first fetch via the runtime handler —
// listing every hashed Google Fonts filename here would be brittle.
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  `./css/themes.css?v=${ASSET_VERSION}`,
  `./css/base.css?v=${ASSET_VERSION}`,
  `./js/main.js?v=${ASSET_VERSION}`,
  "./js/evaluator.js",
  "./js/variants.js",
  "./js/simulate.js",
  "./js/ui.js",
  "./js/explain.js",
  `./themes/vegas-neon.css?v=${ASSET_VERSION}`,
  `./themes/classic-casino.css?v=${ASSET_VERSION}`,
  `./themes/classic-burgundy.css?v=${ASSET_VERSION}`,
  `./themes/brutalist.css?v=${ASSET_VERSION}`,
  `./themes/brutalist-dark.css?v=${ASSET_VERSION}`,
  `./themes/editorial.css?v=${ASSET_VERSION}`,
  `./themes/print.css?v=${ASSET_VERSION}`,
  `./themes/terminal.css?v=${ASSET_VERSION}`,
  "./themes/fonts/jetbrains-mono.css",
  "./themes/fonts/playfair-cormorant.css",
  "./themes/fonts/source-serif-4.css",
  "./themes/fonts/monoton-bebas.css",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  // Only intercept GET requests on this origin. Anything else (POSTs to other
  // origins, browser-internal requests) passes through untouched.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        // Cache successful same-origin responses for next time. The runtime
        // catch is how WOFF2 font files end up in the cache after the first
        // theme that needs them is loaded.
        if (resp && resp.ok && resp.type === "basic") {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return resp;
      }).catch(() => {
        // Offline + not in cache. For navigation requests, fall back to the
        // shell so a stale install can still boot.
        if (req.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
