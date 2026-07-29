# Detalle de caja a pantalla completa

## Contexto

Hoy en `/cajas`, al tocar el ícono "Ver detalle" se abre el `Dialog` de líneas 1372-1525 con un resumen limitado: solo movimientos manuales de `movimientos_caja` (ingresos/egresos) más el arqueo si está cerrada. No se ven las ventas ni los pagos que efectivamente pasaron por la caja, y el modal quedó chico para mucha información.

## Cambios

### 1. Nueva ruta `/cajas/:id` — `src/pages/CajaDetalle.tsx`

Página full-screen dentro de `MainLayout`, cargada con `React.lazy` en `src/App.tsx`, ruta protegida igual que `/cajas`.

**Header sticky** con:
- Fecha/hora de apertura y cierre, usuario, sucursal, estado (badge).
- KPIs: fondo inicial, total ventas, total egresos, esperado, declarado, diferencia.
- Botones: "Volver", "Imprimir arqueo" (si cerrada), "Ver en Imputación" (si tiene permiso transferencias.ver), "Confirmar arqueo" (admin, pendiente revisión).

**Tabs**:

1. **Resumen** — grilla `get_arqueo_por_medio` (esperado vs declarado por categoría) con drill-down inline (reusa `DetalleOperacionesArqueoDialog`).
2. **Ventas** — tabla de `ventas` filtradas por `caja_id`, con columnas: hora, N°, cliente, vendedor, total, medios de pago (chips desde `venta_pagos`+`formas_pago`), estado. Filtros: rango de fecha (por defecto la caja), texto (N°/cliente), forma de pago, anuladas sí/no. Acción por fila: "Abrir venta" → `/ventas?venta=<id>` (o modal actual si existe).
3. **Pagos** — tabla plana de `venta_pagos` unidos a la venta y forma de pago, filtros por categoría (efectivo/débito/crédito/transferencia/cheque/otro) y por forma de pago. Acción contextual:
   - transferencia → "Ver comprobante" (navega a `/imputacion?transferencia=<id>` — extender `Imputacion.tsx` para aceptar `?transferencia=` además del `?caja=` actual).
   - cheque → link a `/cheques?id=<id>`.
   - tarjeta → mostrar cuotas y N° operación en un popover.
4. **Ingresos/Egresos** — tabla de `movimientos_caja` (lo que hoy se muestra) con filtro por tipo y por texto. Admin conserva "Editar" e "Eliminar" (nueva acción, borrado suave restando del total correspondiente y refrescando `total_ventas`/`total_egresos` como ya hace `handleEditarMovimiento`).
5. **Arqueo** (solo si cerrada) — lo que hoy muestra el diálogo: detalle de efectivo por denominación + otros medios + total contado + diferencia. Botón "Imprimir arqueo".

Filtros comunes en la barra superior de cada tab: texto libre + limpiar. Persisten en el estado local, no en URL.

### 2. Cambios en `src/pages/Cajas.tsx`

- Reemplazar el `openDetalleDialog` por `navigate(\`/cajas/\${caja.id}\`)`.
- Eliminar el `Dialog` de detalle (líneas 1372-1525) y todos los estados/handlers que sólo lo servían: `detalleDialogOpen`, `selectedCaja` (si no lo necesita otro flujo), `movimientos`, `arqueoDetalles`, `arqueoOtrosMedios`, `handlePrintArqueo`, `openDetalleDialog`. Verificar que `EditarArqueoDialog`, `ConfirmarArqueoDialog` y `DetalleOperacionesArqueoDialog` sigan recibiendo `caja` desde otras fuentes (arqueo pendiente / cierre) — si no, migrarlos también a `/cajas/:id`.
- Mantener el listado y las acciones de la fila (abrir, cerrar, arqueo pendiente).

### 3. Extensión chica en `src/pages/Imputacion.tsx`

Aceptar `?transferencia=<id>` además del ya soportado `?caja=<id>`: si viene, filtrar a esa fila y expandirla (chip "Filtrando por transferencia..." con opción de limpiar). Sin cambios de RLS.

### 4. Sin cambios de DB

Toda la data ya existe. Las consultas usan RLS existente (`ventas`, `venta_pagos`, `movimientos_caja`, `arqueo_*`).

## Consideraciones técnicas

- Todas las tablas nuevas se paginan client-side; para cajas con muchos movimientos, cargar `.range(0, 999)` es suficiente (una caja abarca ≤24 h).
- `venta_pagos` se resuelve con un join a `ventas` (`caja_id.eq(id)`) y a `formas_pago` para el nombre; hoy `Cajas.tsx` ya hace algo similar en el cierre — reutilizar patrón.
- Impresión: mover `handlePrintArqueo` a `src/lib/imprimirArqueo.ts` para poder usarla desde ambos lugares (o desde la nueva página solamente si eliminamos el modal).
- Permisos: la lectura de la caja hoy ya está filtrada por RLS/rol. La nueva ruta hereda `MainLayout` y la protección de rutas existente.

## Fuera de alcance

- No se cambia el arqueo asistido ni las RPCs `get_arqueo_por_medio` / `confirmar_arqueo_con_ajuste`.
- No se agregan exports Excel/PDF en esta iteración (se puede pedir después).
- No se rehace el estilo del listado principal `/cajas`.
