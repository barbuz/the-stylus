// Service Worker for The Stylus PWA
const CACHE_NAME = 'the-stylus-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/js/main.js',
  '/js/config.js',
  '/js/modules/authManager.js',
  '/js/modules/deckNotesEditor.js',
  '/js/modules/googleSheetsAPI.js',
  '/js/modules/guruAnalysisInterface.js',
  '/js/modules/guruSignature.js',
  '/js/modules/recentPods.js',
  '/js/modules/scryfallAPI.js',
  '/js/modules/uiController.js',
  '/js/modules/userPreferences.js',
  '/js/utils/constants.js',
  '/js/utils/domUtils.js',
  '/images/stylus-logo.png',
  '/images/Discord-Symbol-Blurple.svg',
  '/favicons/favicon.ico',
  '/favicons/favicon-16x16.png',
  '/favicons/favicon-32x32.png',
  '/favicons/apple-touch-icon.png',
  '/favicons/android-chrome-192x192.png',
  '/favicons/android-chrome-512x512.png',
  '/site.webmanifest'
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
        console.log('✅ [Service Worker] Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('❌ [Service Worker] Installation failed:', error);
        console.error('Error details:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('⚡ [Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ [Service Worker] Activation complete');
        return self.clients.claim(); // Take control immediately
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

  // TRUE Cache-first strategy for Scryfall images (never refetch if cached)
  if (url.hostname.includes('scryfall.com') && url.pathname.includes('/cards/')) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('🖼️ [Service Worker] Serving Scryfall image from cache:', url);
            return cachedResponse;
          }
          
          // Not in cache, fetch and cache it
          console.log('📥 [Service Worker] Fetching Scryfall image:', url);
          return fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
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
