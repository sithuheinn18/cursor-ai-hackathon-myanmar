const CACHE_NAME = "voltpulse-static-v1";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/src/app.js",
  "/src/styles/main.scss",
];

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/");
}

async function cacheUrl(cache, url) {
  try {
    await cache.add(url);
  } catch {
    // Skip missing paths (Parcel hashed bundles vs source files).
  }
}

async function precacheStaticAssets() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(PRECACHE_URLS.map((url) => cacheUrl(cache, url)));

  const indexResponse =
    (await cache.match("/index.html")) || (await cache.match("/"));

  if (!indexResponse) {
    return;
  }

  const html = await indexResponse.clone().text();
  const assetUrls = [
    ...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js))"/gi),
  ].map((match) => new URL(match[1], self.location.origin).pathname);

  await Promise.all(
    [...new Set(assetUrls)].map((url) => cacheUrl(cache, url))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheStaticAssets().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || isApiRequest(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});
