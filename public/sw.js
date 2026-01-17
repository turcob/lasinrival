const CACHE_NAME = 'descuentos-pwa-v4';
const urlsToCache = [
  '/admin-descuentos',
  '/auth',
  '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache install error:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API calls and Supabase requests - always go to network
  if (event.request.url.includes('/functions/') || 
      event.request.url.includes('supabase') ||
      event.request.url.includes('/rest/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let data = {
    title: 'Nueva Notificación',
    body: 'Tienes una nueva notificación',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.log('Error parsing push data:', e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'default',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  // Open or focus the admin descuentos page
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes('/admin-descuentos') && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow('/admin-descuentos');
        }
      })
  );
});

// Background sync for checking new solicitudes
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-solicitudes') {
    event.waitUntil(checkForNewSolicitudes());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-solicitudes') {
    event.waitUntil(checkForNewSolicitudes());
  }
});

// Check for new solicitudes (called periodically or on sync)
async function checkForNewSolicitudes() {
  try {
    // Get the stored last check time
    const cache = await caches.open('solicitudes-data');
    const lastCheckResponse = await cache.match('last-check-time');
    const lastCheckTime = lastCheckResponse ? await lastCheckResponse.text() : null;
    
    console.log('Checking for new solicitudes since:', lastCheckTime);
    
    // Store current time for next check
    await cache.put('last-check-time', new Response(new Date().toISOString()));
    
  } catch (error) {
    console.error('Error checking for solicitudes:', error);
  }
}

// Message handler for manual checks
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_SOLICITUDES') {
    checkForNewSolicitudes();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'solicitud-' + (data?.solicitud_id || Date.now()),
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data
    });
  }
});
