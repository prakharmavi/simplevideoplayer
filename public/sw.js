const CACHE_NAME = 'svp-cache-v1';

const PRECACHE_ASSETS = ['/', '/screen'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Keep only the current cache version to avoid stale responses from older releases.
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // This runs for requests from controlled pages in this SW scope, including third-party GETs.
    // Skip non-GET requests and extension URLs.
    if (request.method !== 'GET' || request.url.startsWith('chrome-extension'))
        return;

    // For navigation requests, try network first, fall back to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match(request) || caches.match('/'))
        );
        return;
    }

    // For static assets, use stale-while-revalidate strategy
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request)
                .then((response) => {
                    // Only cache same-origin responses
                    if (response.ok && new URL(request.url).origin === self.location.origin) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || fetchPromise;
        })
    );
});
