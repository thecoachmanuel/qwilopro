const CACHE_NAME = 'qwilopro-pwa-v2';

const STATIC_PRECACHE = [
  '/',
  '/favicon.png',
  '/logo.png',
  '/logo_192.png',
  '/tap.mp3',
  '/new_order_sound.mp3',
  '/manifest.json',
  '/locales/en/translation.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('Some precache assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, DELETE are handled by offline queue in app)
  if (request.method !== 'GET') {
    return;
  }

  // Handle HTML navigation requests (opening pages, refreshing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // If offline or network failed, serve matched cache or fallback to cached root /
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/');
          if (fallback) return fallback;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>QwiloPro Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#fff;"><div style="text-align:center;padding:20px;"><h2>Working Offline</h2><p>Please launch QwiloPro from your saved screen or wait for connection.</p><button onclick="window.location.reload()" style="padding:10px 20px;border-radius:8px;background:#10b981;border:none;color:#fff;font-weight:bold;cursor:pointer;">Retry</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Handle static assets (_next/static, chunks, fonts, images, sounds, translations)
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/locales/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.avif') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.json');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch updated version in background to keep cache fresh
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            return new Response('', { status: 408, statusText: 'Request Timeout' });
          });
      })
    );
    return;
  }

  // Fallback default network-first
  event.respondWith(
    fetch(request).catch(async () => {
      return caches.match(request);
    })
  );
});
