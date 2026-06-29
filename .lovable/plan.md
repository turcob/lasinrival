## Diagnóstico — Causa del problema

La aplicación tiene un **Service Worker (`public/sw.js`) registrado para todos los usuarios en todas las rutas** (no solo en `/admin-descuentos` como sugiere el manifest). Ese SW tiene un handler `fetch` que aplica estrategia **"network-first con fallback a caché"** sobre **todos los GET** del sitio, incluyendo:

- `index.html`
- los bundles JS/CSS con hash de Vite
- imágenes y assets

Cada respuesta exitosa se guarda en `caches.open('descuentos-pwa-v6')`. Cuando hay un fallo momentáneo de red, una respuesta intermedia o el navegador prioriza la caché del SW, se sirve el `index.html` viejo que apunta a chunks JS con hashes que ya no existen en el deploy nuevo → pantalla rota o versión vieja persistente, incluso después de Ctrl+F5 (porque Ctrl+F5 no desregistra al SW; el SW intercepta igual).

Además:
- El SW vive en scope `/` aunque solo se necesita para push notifications de descuentos.
- No hay ningún mecanismo en la app para detectar que se publicó una versión nueva.
- Los headers de hosting de Lovable ya revalidan `index.html` correctamente, pero el SW los anula.

## Cambios a implementar

### 1) `public/sw.js` — neutralizar el caché de app-shell, conservar push

Mantener intactos los handlers `push`, `notificationclick`, `sync`, `periodicsync`, `message` (los necesita el PWA de descuentos). Cambios:

- Subir `CACHE_NAME` a `descuentos-pwa-v7`.
- **Eliminar por completo el handler `fetch`** (causa raíz). Sin `fetch`, el SW deja de interceptar navegación y assets; el navegador y los headers de Lovable manejan el caché correctamente.
- En `install`: no precachear nada (`urlsToCache = []`) + `skipWaiting()`.
- En `activate`: borrar **todas** las cachés cuyo nombre empiece con `descuentos-pwa-` o sea `solicitudes-data`, luego `clients.claim()` y forzar `client.navigate(client.url)` en todos los clientes abiertos para que descarten el HTML viejo.

Esto actúa como kill-switch del caché actual sin perder push notifications.

### 2) Detector de nueva versión

a) **Generar versión en cada build.** Editar `vite.config.ts` para inyectar `__APP_VERSION__` con `Date.now()` vía `define`, y agregar un pequeño plugin que escriba `dist/version.json` con `{ "version": "<timestamp>" }` al terminar el build.

b) **Hook `useVersionCheck`** en `src/hooks/useVersionCheck.ts`:
- Al montar y en cada `visibilitychange` cuando la pestaña vuelve a estar visible (y cada 5 min via `setInterval`), hacer `fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })`.
- Comparar con `__APP_VERSION__` embebido en el bundle actual.
- Si difieren, exponer `nuevaVersionDisponible = true`.

c) **UI no intrusiva** en `src/components/UpdateBanner.tsx` y montarla en `src/App.tsx`:
- Toast persistente (sonner) o banner fijo abajo con texto: **"Hay una nueva versión del sistema disponible."** y botón **"Actualizar"**.
- Acción del botón:
  1. `navigator.serviceWorker.getRegistrations()` → `unregister()` de cada uno.
  2. `caches.keys()` → `caches.delete()` de todos.
  3. `location.reload()` (recarga limpia; los hashes nuevos de Vite garantizan que se baje todo de nuevo).

### 3) Verificación

- Build y deploy.
- Confirmar en DevTools › Application que el SW activo ya no tiene handler `fetch` y que las cachés viejas `descuentos-pwa-v6` y `solicitudes-data` se eliminan.
- Publicar un cambio menor; verificar que aparece el banner "Actualizar" en pestañas abiertas al volver el foco.

## Notas técnicas

- No se introduce `vite-plugin-pwa` ni Workbox: el SW se mantiene a mano porque su rol real es push, no offline.
- `start_url` y `scope` del manifest siguen apuntando a `/admin-descuentos` (PWA instalada de descuentos); el SW deja de interferir con el resto del sistema.
- Usuarios con la versión actual rota recibirán el SW nuevo (mismo path `/sw.js`), su `activate` borrará sus cachés y navegará la pestaña → quedan en la versión nueva sin tocar nada.
- No se modifican headers de hosting (Lovable ya sirve `index.html` con revalidación) ni el manifest ni las edge functions.

## Archivos afectados

- `public/sw.js` — reescribir según punto 1.
- `vite.config.ts` — `define` + plugin para `version.json`.
- `src/hooks/useVersionCheck.ts` — nuevo.
- `src/components/UpdateBanner.tsx` — nuevo.
- `src/App.tsx` — montar `<UpdateBanner />`.
- `src/vite-env.d.ts` — declarar `__APP_VERSION__`.
