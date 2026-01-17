const CACHE_NAME = 'descuentos-pwa-v5';
const urlsToCache = [
  '/admin-descuentos',
  '/auth',
  '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v5');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('[SW] Cache install error:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v5');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
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
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.url.includes('/functions/') || 
      event.request.url.includes('supabase') ||
      event.request.url.includes('/rest/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
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
        return caches.match(event.request);
      })
  );
});

// Push event - iOS Safari compatible handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received at:', new Date().toISOString());
  
  // CRITICAL: For iOS, we must handle the notification inside waitUntil
  const handlePush = async () => {
    let title = 'Nueva Solicitud';
    let body = 'Tienes una nueva solicitud de descuento';
    
    // Try to get data from push event
    if (event.data) {
      try {
        const text = event.data.text();
        console.log('[SW] Raw push data:', text);
        
        const data = JSON.parse(text);
        title = data.title || title;
        body = data.body || body;
        console.log('[SW] Parsed push data - title:', title, 'body:', body);
      } catch (e) {
        console.log('[SW] Could not parse push data:', e);
        // Use defaults
      }
    } else {
      console.log('[SW] No push data received, using defaults');
    }
    
    // Show notification with MINIMAL options for iOS compatibility
    console.log('[SW] Showing notification:', title);
    
    try {
      await self.registration.showNotification(title, {
        body: body,
        icon: '/icons/icon-192.png',
        tag: 'descuento-' + Date.now()
      });
      console.log('[SW] Notification shown successfully');
    } catch (notifError) {
      console.error('[SW] Error showing notification:', notifError);
    }
    
    // Notify any open clients about the push (for debugging)
    try {
      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      allClients.forEach(client => {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          title: title,
          body: body,
          timestamp: Date.now()
        });
      });
    } catch (clientError) {
      console.log('[SW] Could not notify clients:', clientError);
    }
  };
  
  event.waitUntil(handlePush());
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/admin-descuentos') && 'focus' in client) {
            return client.focus();
          }
        }
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

// Check for new solicitudes
async function checkForNewSolicitudes() {
  try {
    const cache = await caches.open('solicitudes-data');
    const lastCheckResponse = await cache.match('last-check-time');
    const lastCheckTime = lastCheckResponse ? await lastCheckResponse.text() : null;
    
    console.log('[SW] Checking for new solicitudes since:', lastCheckTime);
    await cache.put('last-check-time', new Response(new Date().toISOString()));
  } catch (error) {
    console.error('[SW] Error checking for solicitudes:', error);
  }
}

// Message handler
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data?.type);
  
  if (event.data && event.data.type === 'CHECK_SOLICITUDES') {
    checkForNewSolicitudes();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag: 'solicitud-' + Date.now()
    });
  }
  
  if (event.data && event.data.type === 'TEST_PUSH') {
    console.log('[SW] Test push requested');
    self.registration.showNotification('Test Push', {
      body: 'Service Worker está funcionando correctamente',
      icon: '/icons/icon-192.png',
      tag: 'test-' + Date.now()
    });
  }
});