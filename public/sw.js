const CACHE_NAME = 'symx-v3';

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

  // Skip Webpack HMR and dev requests
  if (
    url.pathname.includes('/_next/webpack-hmr') ||
    url.pathname.includes('hot-update') ||
    url.pathname.includes('__nextjs')
  ) return;

  // For navigation requests (pages) — Network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline → try cache in order of preference
          const cached = await caches.match(request);
          if (cached) return cached;
          const dashboard = await caches.match('/dashboard');
          if (dashboard) return dashboard;
          const login = await caches.match('/login');
          if (login) return login;
          // Last resort: return a minimal offline response
          return new Response('Offline – please check your connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
          });
        })
    );
    return;
  }

  // For static assets (JS, CSS, images, fonts) — Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
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
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
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

  // Everything else — Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503 });
      })
  );
});

// ── Background Sync (for offline mutations) ─────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Future: replay queued POST/PUT requests from IndexedDB
      Promise.resolve()
    );
  }
});

// ── Push Notifications (future-ready) ───────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'SYMX Systems', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: data.tag || 'general',
      data: { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing window if possible
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
