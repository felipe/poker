// Service worker for offline-first behavior.
//
// Strategy: cache-first for the shell and every same-origin asset, plus the
// Google Fonts CSS + WOFF2 files referenced by the designer themes. On the
// very first visit we still need the network so Google can hand us the
// fonts; from then on everything works offline.
//
// Bumping ASSET_VERSION renames the cache, which invalidates everything on
// next activation (old caches get deleted in the activate handler).

const ASSET_VERSION = "27";
const CACHE_NAME = `poker-v${ASSET_VERSION}`;

// Pre-cached at install time. Fonts are intentionally NOT listed here — they
// live on Google's CDN and get cached on first fetch via the runtime handler.
// Listing the (User-Agent-dependent) WOFF2 URLs explicitly would be brittle.
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.png",
  `./css/themes.css?v=${ASSET_VERSION}`,
  `./css/base.css?v=${ASSET_VERSION}`,
  `./js/main.js?v=${ASSET_VERSION}`,
  "./js/evaluator.js",
  "./js/variants.js",
  "./js/verdict.js",
  "./js/simulate.js",
  "./js/analysis.js",
  "./js/stats.js",
  "./js/glossary.js",
  "./js/reference.js",
  "./js/ui.js",
  "./js/explain.js",
  "./js/prose.js",
  "./js/explain/core.js",
  "./js/explain/holdem.js",
  "./js/explain/holdem-fragments.js",
  "./js/explain/omaha.js",
  "./js/explain/ultimate.js",
  "./js/explain/draw.js",
  `./themes/vegas-neon.css?v=${ASSET_VERSION}`,
  `./themes/classic-casino.css?v=${ASSET_VERSION}`,
  `./themes/classic-burgundy.css?v=${ASSET_VERSION}`,
  `./themes/brutalist.css?v=${ASSET_VERSION}`,
  `./themes/brutalist-dark.css?v=${ASSET_VERSION}`,
  `./themes/editorial.css?v=${ASSET_VERSION}`,
  `./themes/print.css?v=${ASSET_VERSION}`,
  `./themes/terminal.css?v=${ASSET_VERSION}`,
];

// Cross-origin origins we're willing to cache at runtime. Anything else
// (analytics, ads, etc. — none today, but future-proof) passes straight
// through to the network with no SW intervention.
const RUNTIME_ALLOWED_ORIGINS = new Set([
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
]);

self.addEventListener("install", e => {
  // Force-reload on install so an upstream HTTP cache (CDN, ISP middlebox,
  // browser HTTP cache from a prior visit) can't shadow the version we just
  // bumped to. The cache-name bump alone protects SW-controlled fetches,
  // but the install-time addAll goes through the browser's fetch stack
  // first — without `cache: "reload"` the browser may return a stale
  // response and we'd quietly precache the old asset under the new name.
  const reload = PRECACHE.map(url => new Request(url, { cache: "reload" }));
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(reload))
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
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !RUNTIME_ALLOWED_ORIGINS.has(url.origin)) return;

  // CSS @import fires as a no-cors request — if we passed it through
  // unchanged we'd get an opaque response that's unsafe to cache. For
  // allowed cross-origin requests we re-issue with explicit CORS mode so
  // Google Fonts gives us a non-opaque, introspectable response.
  const fetchReq = sameOrigin
    ? req
    : new Request(req.url, { mode: "cors", credentials: "omit" });

  // For same-origin assets, ignore the `?v=N` cache-busting query when
  // matching: the cache NAME (poker-vN) is the generation boundary, so a
  // request for `main.js?v=9` should hit the precached entry regardless of
  // how the query is spelled. This keeps the precache manifest from silently
  // drifting out of sync with the URLs the app actually requests. Scoped to
  // same-origin so cross-origin font URLs (which DO depend on their query)
  // still match exactly.
  const matchOpts = sameOrigin ? { ignoreSearch: true } : undefined;
  e.respondWith(
    caches.match(req, matchOpts).then(cached => {
      if (cached) return cached;
      return fetch(fetchReq).then(resp => {
        // Cache successful responses. We accept both "basic" (same-origin)
        // and "cors" (cross-origin with CORS headers — Google Fonts sends
        // them). Opaque responses are skipped: they take up an outsized
        // amount of cache quota and we can't introspect them for errors.
        if (resp && resp.ok && (resp.type === "basic" || resp.type === "cors")) {
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
