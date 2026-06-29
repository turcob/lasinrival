const CACHE_NAME = 'descuentos-pwa-v7';

// Install: no precache. Solo activar inmediatamente.
self.addEventListener('install', () => {
  console.log('[SW] Installing v7 (no app-shell cache)');
  self.skipWaiting();
});

// Activate: borrar TODAS las cachés viejas del SW anterior y forzar recarga
// de los clientes para que descarten el index.html cacheado.
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v7 - limpiando cachés viejas');
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.allSettled(
        cacheNames
          .filter((name) => name.startsWith('descuentos-pwa-') || name === 'solicitudes-data')
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
      const windowClients = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(
        windowClients.map((client) => {
          try { return client.navigate(client.url); } catch { return Promise.resolve(); }
        })
      );
    } catch (e) {
      console.error('[SW] Activate error:', e);
    }
  })());
});

// NOTA: se eliminó intencionalmente el handler `fetch`. El SW ya no intercepta
// peticiones de navegación ni de assets. El navegador y los headers de hosting
// gestionan el caché correctamente, garantizando que cada deploy se sirva
// inmediatamente sin necesidad de Ctrl+F5.

// Push event - iOS Safari compatible handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received at:', new Date().toISOString());
  
  // CRITICAL: For iOS, we must handle the notification inside waitUntil
  const handlePush = async () => {
    let title = 'Nueva Solicitud';
    let body = 'Tienes una nueva solicitud de descuento';
    let payloadData = {};

    // Try to get data from push event
    if (event.data) {
      try {
        const text = event.data.text();
        console.log('[SW] Raw push data:', text);
        
        const data = JSON.parse(text);
        title = data.title || title;
        body = data.body || body;
        payloadData = data.data || {};
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
        tag: 'descuento-' + (payloadData.solicitud_id || Date.now()),
        data: payloadData
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
  console.log('[SW] Notification clicked', event.notification.data);
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.solicitud_id
    ? `/admin-descuentos?solicitud=${data.solicitud_id}`
    : '/admin-descuentos';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/admin-descuentos') && 'focus' in client) {
            if ('navigate' in client && data.solicitud_id) {
              return client.navigate(targetUrl).then(() => client.focus()).catch(() => client.focus());
            }
            client.postMessage({ type: 'FOCUS_SOLICITUD', solicitud_id: data.solicitud_id });
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
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