// ─────────────────────────────────────────────
//  잇데이 Service Worker
//  CACHE_VERSION = 자동 (빌드 시 타임스탬프로 교체)
// ─────────────────────────────────────────────
const CACHE_VERSION = '__BUILD_HASH__';
const CACHE_NAME    = `itdasy-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/itdasy-frontend/index.html',
  '/itdasy-frontend/style.css',
  '/itdasy-frontend/app.bundle.min.js',
  '/itdasy-frontend/manifest.json',
];

// ── install: 새 버전 캐시 준비 ──
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ── activate: 구 버전 캐시 전부 삭제 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('itdasy-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── fetch: Network-First 전략 ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (
    url.hostname.includes('railway') ||
    url.hostname.includes('instagram') ||
    url.hostname.includes('facebook') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
