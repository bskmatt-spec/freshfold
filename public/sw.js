const CACHE_NAME = "freshfold-v1";
const STATIC_ASSETS = ["/", "/customer", "/manifest.json", "/icon-192.png", "/icon-512.png"];

// Install: cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/auth, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always go to network for API routes and auth
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/auth")) {
    return;
  }

  // Network-first strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful GET responses
        if (event.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Return the customer page as fallback for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/customer");
          }
        });
      })
  );
});
