const CACHE_NAME = 'symx-v2';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/login',
  '/manifest.json',
  '/symx-logo.png',
  '/logo.png',
  '/sidebar-logo.png',
  '/sidebar-icon.png',
  '/login-bg.jpg',
  '/favicon.png',
];

// ── Install ─────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache critical assets; don't fail install if a URL is missing
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to pre-cache ${url}:`, err.message);
          })
        )
      );
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// ── Activate ────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ── Fetch Strategy ──────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST/PUT/DELETE go straight to network)
  if (request.method !== 'GET') return;

  // Skip API calls — always go to network for fresh data
  if (url.pathname.startsWith('/api/')) return;

  // Skip browser extension requests
  if (!url.protocol.startsWith('http')) return;

  // Skip Webpack HMR requests in development
  if (url.pathname.includes('/_next/webpack-hmr') || url.pathname.includes('hot-update')) return;

  // For navigation requests (pages) — Network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the page for offline use
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline → try cache
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // If nothing cached, return the offline fallback (dashboard or login)
            return caches.match('/dashboard') || caches.match('/login');
          });
        })
    );
    return;
  }

  // For static assets (JS, CSS, images, fonts) — Stale-While-Revalidate
  // Cache-first breaks Next.js Dev Server when chunks update without hashes!
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.otf') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        }).catch(err => {
          if (!cached) throw err;
        });

        // Return cached immediately if available, but fetch in background to update cache
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else — Network first, fallback to cache (stale-while-revalidate)
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(request))
  );
});
