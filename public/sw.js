// Service Worker for مركز الغزلان ERP PWA
// Strategy:
// - Static assets (icons, manifest): Cache First
// - HTML / JS / CSS: Network First with fast fallback to cache
// - API calls (/api/*): Network Only (always fresh data)
// - Images: Stale While Revalidate

const CACHE_VERSION = 'ghazlan-erp-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-167.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-256.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/logo-icon.png',
  '/logo-full.png',
  '/logo-shield.png',
];

// ============ INSTALL ============
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version', CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => {
            console.log('[SW] Removing old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============ FETCH STRATEGY ============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other schemes
  if (!url.protocol.startsWith('http')) return;

  // ===== API: Network Only (no caching, always fresh) =====
  if (url.pathname.startsWith('/api/')) {
    // Don't intercept - let browser handle normally
    return;
  }

  // ===== Server-Sent Events: Network Only =====
  if (url.pathname.includes('/stream')) {
    return;
  }

  // ===== Icons / Logo: Cache First =====
  if (url.pathname.startsWith('/icons/') || url.pathname.match(/^\/logo-/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ===== Static Next.js assets (_next/static): Cache First =====
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ===== Manifest: Cache First =====
  if (url.pathname === '/manifest.json') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ===== Images: Stale While Revalidate =====
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico)$/i)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // ===== HTML pages: Network First (longer timeout for dev) =====
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE, 30000));
    return;
  }

  // ===== Default: Network First =====
  event.respondWith(networkFirst(request, DYNAMIC_CACHE, 30000));
});

// ============ STRATEGIES ============

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName, timeout = 3000) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
    ]);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Final fallback for navigations: return cached homepage
    if (request.mode === 'navigate') {
      const home = await cache.match('/');
      if (home) return home;
    }
    return new Response(
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>غير متصل</title><style>body{background:#0f0f19;color:#d4af37;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;text-align:center;padding:2rem}h1{font-size:2rem}p{color:#888}</style></head><body><h1>📡 لا يوجد اتصال</h1><p>تأكد من اتصالك بالإنترنت ثم أعد المحاولة</p><button onclick="location.reload()" style="margin-top:1rem;background:#d4af37;color:#000;border:none;padding:0.75rem 1.5rem;border-radius:8px;font-weight:bold;cursor:pointer">🔄 إعادة المحاولة</button></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => cached || new Response('Offline', { status: 503 }));
  return cached || fetchPromise;
}

// ============ PUSH NOTIFICATIONS (foundation for future) ============
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'مركز الغزلان';
  const options = {
    body: data.body || data.message || 'لديك إشعار جديد',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || 'ghazlan-notif',
    renotify: !!data.renotify,
    requireInteraction: data.priority === 'high',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ============ MESSAGE HANDLING (skip waiting on update) ============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
