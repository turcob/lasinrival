# Fix: Contadores de tarjetas de estado en Pedidos

## Causa raíz

En `src/pages/Pedidos.tsx` (línea 91-94), el hook `usePedidos` se llama pasando el filtro de estado activo al servidor:

```ts
const { data: pedidos } = usePedidos({
  estado: filtroEstado !== 'todos' ? filtroEstado : undefined,
  tipoPedido: ...
});
```

Esto significa que el dataset `pedidos` solo contiene los pedidos del estado seleccionado (ej. solo "pendiente"). Por eso las tarjetas de "Preparado", "Despachado" y "Rechazado" muestran 0 — no hay datos de esos estados en memoria.

Cuando el usuario clickea otra tarjeta, cambia `filtroEstado`, se relanza la query, y recién entonces aparece el contador de ese estado (mientras los otros vuelven a quedar en 0).

## Solución propuesta

Mover el filtrado por estado del lado servidor al lado cliente, de modo que la página siempre tenga en memoria todos los pedidos del tipo elegido (web / reparto / ambos) y los contadores se calculen siempre sobre el total real.

### Cambios en `src/pages/Pedidos.tsx`

1. Quitar `estado` del parámetro de `usePedidos`:
   ```ts
   const { data: pedidos, isLoading } = usePedidos({
     tipoPedido: tipoPedidoFiltro !== 'ambos' ? tipoPedidoFiltro : undefined,
   });
   ```

2. Agregar el filtro de estado dentro del `useMemo` de `pedidosFiltrados`, junto con búsqueda/fechas:
   ```ts
   if (filtroEstado !== 'todos') {
     resultado = resultado.filter(p => p.estado === filtroEstado);
   }
   ```
   Incluir `filtroEstado` en las dependencias del `useMemo`.

3. Recalcular los contadores siempre sobre la lista completa filtrada por búsqueda/fecha (sin aplicar el filtro de estado), para que cada tarjeta muestre la cantidad real de pedidos visibles del dataset actual:
   ```ts
   const conteoPorEstado = useMemo(() => {
     const base = (pedidos || []).filter(/* aplicar busqueda/producto/fechas, NO estado */);
     return estadosActivos.reduce((acc, est) => {
       acc[est] = base.filter(p => p.estado === est).length;
       return acc;
     }, {} as Record<PedidoEstado, number>);
   }, [pedidos, busqueda, busquedaProducto, fechaDesde, fechaHasta]);
   ```
   Y reemplazar el cálculo actual del bloque `{/* Stats */}` por `conteoPorEstado[key]`.

Con esto:
- Al crear / cambiar estado / rechazar un pedido, React Query invalida `['pedidos']` (ya implementado en `usePedidos.ts`) → se refetchea el dataset completo → los contadores se actualizan automáticamente.
- Al cambiar búsqueda, producto o fechas, los contadores se recalculan vía `useMemo`.
- Ya no hace falta clickear una tarjeta para "refrescar".

## Consideraciones técnicas

- Performance: la query trae todos los pedidos (sin paginación por estado). Para volúmenes muy grandes podría ser pesado, pero hoy ya se devuelven todos los detalles anidados igual; mover el filtro a cliente no agrega carga significativa porque antes también se traían todos al cambiar de tarjeta.
- No se tocan hooks, queries de Supabase, ni esquema. Cambio aislado a la vista.

## Archivos a modificar

- `src/pages/Pedidos.tsx` (único archivo)
