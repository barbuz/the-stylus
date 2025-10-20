// Service Worker for The Stylus PWA

// Version configuration - UPDATE THIS to trigger a service worker update
const APP_VERSION = 'v20251020-1';
const APP_NAME = 'the-stylus';
const CACHE_NAME = `${APP_NAME}-${APP_VERSION}`;

const SCRYFALL_CACHE_NAME = 'the-stylus-scryfall-permanent';

// Get the base path (works for both root and subdirectory deployments)
const BASE_PATH = self.location.pathname.replace(/sw\.js$/, '');

const urlsToCache = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}styles/main.css`,
  `${BASE_PATH}js/main.js`,
  `${BASE_PATH}js/config.js`,
  `${BASE_PATH}js/modules/authManager.js`,
  `${BASE_PATH}js/modules/deckNotesEditor.js`,
  `${BASE_PATH}js/modules/googleSheetsAPI.js`,
  `${BASE_PATH}js/modules/guruAnalysisInterface.js`,
  `${BASE_PATH}js/modules/guruSignature.js`,
  `${BASE_PATH}js/modules/hubManager.js`,
  `${BASE_PATH}js/modules/recentPods.js`,
  `${BASE_PATH}js/modules/scryfallAPI.js`,
  `${BASE_PATH}js/modules/uiController.js`,
  `${BASE_PATH}js/modules/userPreferences.js`,
  `${BASE_PATH}js/utils/constants.js`,
  `${BASE_PATH}js/utils/domUtils.js`,
  `${BASE_PATH}js/utils/podUtils.js`,
  `${BASE_PATH}js/utils/urlUtils.js`,
  `${BASE_PATH}images/stylus-logo.png`,
  `${BASE_PATH}images/Discord-Symbol-Blurple.svg`,
  `${BASE_PATH}favicons/favicon.ico`,
  `${BASE_PATH}favicons/favicon-16x16.png`,
  `${BASE_PATH}favicons/favicon-32x32.png`,
  `${BASE_PATH}favicons/apple-touch-icon.png`,
  `${BASE_PATH}favicons/android-chrome-192x192.png`,
  `${BASE_PATH}favicons/android-chrome-512x512.png`,
  `${BASE_PATH}site.webmanifest`
];


// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('🚀 [Service Worker] Installing...');
  console.log('📦 [Service Worker] Cache name:', CACHE_NAME);
  console.log('📋 [Service Worker] URLs to cache:', urlsToCache.length);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ [Service Worker] Installation complete - waiting for user action');
        // Don't call skipWaiting() here - let the user decide when to update
      })
      .catch((error) => {
        console.error('❌ [Service Worker] Installation failed:', error);
        console.error('Error details:', error);
      })
  );
});

// Activate event - clean up old caches (but preserve Scryfall cache)
self.addEventListener('activate', (event) => {
  console.log('⚡ [Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Keep current app cache and permanent Scryfall cache
            if (cacheName !== CACHE_NAME && cacheName !== SCRYFALL_CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ [Service Worker] Activation complete');
        console.log('📦 [Service Worker] Active caches:', CACHE_NAME, SCRYFALL_CACHE_NAME);
        // clients.claim() will be called after user clicks reload
        // This ensures controlled activation
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Network-first strategy for API calls (Google Sheets)
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // If network fails, try cache (for offline fallback)
          return caches.match(request);
        })
    );
    return;
  }

  // Permanent Cache-first strategy for Scryfall images (separate permanent cache)
  if (url.hostname.includes('scryfall.com') && url.pathname.includes('/cards/')) {
    event.respondWith(
      caches.match(request, { cacheName: SCRYFALL_CACHE_NAME })
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('🖼️ [Service Worker] Serving Scryfall image from permanent cache:', url);
            return cachedResponse;
          }
          
          // Not in permanent cache, fetch and cache it
          console.log('📥 [Service Worker] Fetching Scryfall image:', url);
          return fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(SCRYFALL_CACHE_NAME).then((cache) => {
                  console.log('💾 [Service Worker] Caching Scryfall image permanently:', url);
                  cache.put(request, responseToCache);
                });
              }
              return response;
            });
        })
    );
    return;
  }

  // Stale-while-revalidate strategy for app resources
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version and update cache in background
          console.log('📦 [Service Worker] Serving from cache (revalidating):', request.url);
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response);
                });
              }
            })
            .catch(() => {
              // Network failed, but we have cache - ignore error
            });
          
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            console.log('[Service Worker] Fetched from network:', request.url);
            // Check if valid response
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch failed:', error);
            throw error;
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
