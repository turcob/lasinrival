## Objetivo

Desde el detalle de la venta (pantalla **Ventas**), permitir ver el comprobante adjunto de la transferencia y saltar directo a la pantalla de **Imputación de Pagos** para validar los datos con IA.

## Cambios

### 1. `src/pages/Ventas.tsx` — Detalle de venta enriquecido con transferencia

En `openDetalleDialog`, además de traer `venta_pagos`, hacer un `SELECT` a `transferencias` filtrando por `venta_id = venta.id`. Guardar el resultado en un nuevo estado `transferenciasVenta` (array).

En el modal de detalle (bloque "Formas de Pago"), para cada pago cuyo método sea Transferencia y exista una transferencia asociada, agregar una tarjeta / bloque adicional con:

- Estado de la transferencia (`pendiente` / `validada` / `rechazada`) con badge.
- Nº de operación, titular, CUIL, banco, fecha, importe (los que estén cargados).
- **Botón "Ver comprobante"**: abre `foto_comprobante_path` en Supabase Storage (bucket usado por Imputación, generar signed URL igual que en `Imputacion.tsx`).
- **Botón "Ir a validación"** (solo si `estado = 'pendiente'`): navega a `/imputacion?transferencia_id=<uuid>`.

### 2. `src/pages/Imputacion.tsx` — Auto-apertura del modal de validación por URL

- Leer `useSearchParams()` al montar.
- Si viene `?transferencia_id=<uuid>`, tras cargar la lista de movimientos pendientes, localizar el movimiento con `source === 'transferencia'` y `transferencia_id` coincidente y ejecutar la misma acción que hace click "Validar / completar" hoy: setear `selectedMovimiento` y abrir el modal de detalle/edición existente.
- Cambiar automáticamente a la pestaña **Pendientes** si no está activa.
- Si la transferencia ya no está pendiente (fue validada/rechazada), abrir el modal en modo lectura sobre la pestaña correspondiente y mostrar un toast informativo.
- Limpiar el query param con `setSearchParams({})` luego de abrir para evitar reaperturas al refrescar.

### 3. Sin cambios de backend

No se toca la base de datos ni RLS. `transferencias` ya está vinculada a `venta_id` y la RLS actual permite al usuario ver sus transferencias.

## Fuera de alcance

- No se modifica el flujo de validación en sí (IA, guardado, imputación FIFO).
- No se modifica el POS ni la creación de transferencias.
- No se agregan nuevas columnas ni migraciones.

## Detalle técnico

- Ruta destino: `navigate(`/imputacion?transferencia_id=${t.id}`)` usando `useNavigate` (ya importado en Ventas).
- Signed URL del comprobante: replicar el helper que usa `Imputacion.tsx` (`supabase.storage.from(<bucket>).createSignedUrl(path, 60)`).
- El botón "Ir a validación" queda visible únicamente para usuarios con acceso a la sección Imputación (ya protegida por rutas/permisos existentes; no se agrega gating extra en Ventas para evitar duplicar lógica — si el usuario no tiene permiso, la ruta lo redirige).
