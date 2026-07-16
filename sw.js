const CACHE_NAME = 'payoffpal-cache-v1';

// On install, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// On activation, clean up old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// On fetch, use a cache-falling-back-to-network strategy
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If the fetch is successful, cache the new response for next time
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(error => {
            // This is important for when the network fails and there's no cached response.
            console.error('Fetch failed; returning offline fallback if available.', error);
            // A real-world app might return a custom offline page here.
            // For now, the browser's default offline error will show.
            throw error;
        });

        // Return the cached response if it exists, otherwise, wait for the network response.
        return cachedResponse || fetchPromise;
      });
    })
  );
});
