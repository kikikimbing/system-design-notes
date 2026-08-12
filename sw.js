/* Service worker for the System Design Notes PWA.
 * Strategy:
 *   - Precache a small app shell on install (home page + manifest + icons).
 *   - Navigations: network-first, fall back to cache, then to the home page.
 *   - Other same-origin GETs (CSS/JS/images/pages): cache-first with a
 *     background revalidate (stale-while-revalidate).
 * Every branch resolves to a real Response so a fetch never hangs.
 * URLs are relative to the SW scope so it also works under a subpath.
 */
const VERSION = "v3";
const CACHE = "sd-notes-" + VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./pwa/manifest.webmanifest",
  "./pwa/icon-192.png",
  "./pwa/icon-512.png",
  "./pwa/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function handleNavigate(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (
      (await cache.match(req)) ||
      (await cache.match("./index.html")) ||
      Response.error()
    );
  }
}

async function handleAsset(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) {
    fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(handleNavigate(req));
  } else {
    event.respondWith(handleAsset(req));
  }
});
