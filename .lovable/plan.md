## Diagnóstico

Revisé `src/pages/Ventas.tsx` (filtros en `ventasFiltradas` y UI de selects/calendar). Encontré dos bugs concretos y verifiqué el resto:

### Bug 1 — Filtro por fecha no funciona (causa principal)
Los dos `CalendarComponent` (Desde/Hasta) están montados dentro de un `Popover` **sin** la clase `pointer-events-auto`. Por la regla conocida de shadcn/Radix, el calendario queda con los clicks bloqueados dentro del popover, así que el usuario abre el calendario, hace click en un día y no pasa nada: `fechaDesde`/`fechaHasta` nunca se setean → `ventasFiltradas` nunca recibe el filtro.

### Bug 2 — Filtro "Estado = Pedidos" oculta justo los pedidos
En `ventasFiltradas`:
```ts
if (filtroEstado !== 'todos') {
  if (v._es_pedido) {
    if (filtroEstado === 'pedido') return false; // invertido
  } else if (v.estado !== filtroEstado) {
    return false;
  }
}
```
Las filas sintéticas de pedidos web/reparto (`_es_pedido = true`) se descartan cuando el usuario elige "Pedidos", y se muestran cuando elige "Confirmadas" (porque su `estado` sintético es `'confirmada'`). Es exactamente al revés de lo esperado.

### Filtros verificados OK (no se tocan)
- **Usuario**: compara `v.usuario_id` contra el id seleccionado. Correcto.
- **Vendedor del cliente**: lee `v.clientes?.vendedor_id` (ya viene en el `select` de `fetchVentas`). Correcto, incluido el caso "Sin vendedor".
- **Origen**: usa `origenPorVenta[v.id]` con default `'mostrador'`. Correcto para reales y sintéticas (en sintéticas la key es el `pedido_id` que también es `v.id`).
- **Búsqueda por Nº comprobante**: la maneja `DataTable` sobre `numero_comprobante`. Correcto.

## Cambios

Archivo único: `src/pages/Ventas.tsx`.

1. **Calendar Desde y Hasta** (líneas ~760 y ~777): agregar `className="p-3 pointer-events-auto"` a ambos `CalendarComponent` para que los clicks lleguen al día y `onSelect` dispare el cambio de estado.

2. **Filtro Estado** (bloque dentro de `ventasFiltradas`): reescribir la rama de `_es_pedido` para que:
   - Con `filtroEstado === 'pedido'` → las filas sintéticas pasan (no se descartan).
   - Con `filtroEstado === 'confirmada'` → las filas sintéticas no pasan (hoy se cuelan).
   - Con `filtroEstado === 'todos'` → todo pasa (sin cambios).

   Queda así:
   ```ts
   if (filtroEstado !== 'todos') {
     if (v._es_pedido) {
       if (filtroEstado !== 'pedido') return false;
     } else if (v.estado !== filtroEstado) {
       return false;
     }
   }
   ```

## Fuera de alcance

- No se cambian RPCs ni esquema.
- No se modifica la lógica de carga (`fetchVentas`) ni el resumen RPC de totales.
- No se tocan permisos ni columnas de la tabla.
