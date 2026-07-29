# Reimpresión de picking con items agregados

## Problema

Hoy, cuando un pedido pasa a **En preparación**, la cajera lo puede volver a abrir para editar el carrito, pero las únicas acciones disponibles son:
- **Confirmar preparado** (cierra la preparación).
- **Salir** sin guardar.

No hay forma de **agregar items** y **reimprimir el picking actualizado** manteniendo el pedido en `en_preparacion`. Además, la RPC `pos_actualizar_pedido_estado` sólo acepta transiciones entre estados distintos, así que "guardar sin cambiar estado" tampoco es posible hoy.

## Objetivo

Cuando la cajera esté editando un pedido `en_preparacion`, poder:
1. Sumar/quitar items en el carrito.
2. Guardar los cambios en el pedido.
3. Reimprimir el ticket de picking con los items actualizados.
4. Que el pedido siga en `en_preparacion` (no se marca como preparado).

## Cambios

### 1. Migración DB — `pos_actualizar_pedido_estado`

Extender la lista de transiciones válidas para aceptar el "no-op" que sólo persiste detalles:

```text
en_preparacion  →  en_preparacion    (permitido)
preparado       →  preparado         (permitido, por si se re-abre un preparado)
```

El resto de la lógica queda igual: ownership, lock, reemplazo de `venta_detalles` cuando `p_detalles` viene, recálculo de `subtotal / descuento / total`. No se toca `preparado_at` / `preparado_por` porque el estado no cambia a `preparado`.

### 2. Front — `src/pages/POS.tsx`

- Nuevo handler `handleActualizarYReimprimir()` (variante de `handleConfirmarPreparadoInline`):
  - Valida cart no vacío y cantidades/precios > 0.
  - Arma `detallesPayload` igual que hoy.
  - Llama `rpc('pos_actualizar_pedido_estado', { p_venta_id, p_nuevo_estado: 'en_preparacion', p_detalles })`.
  - Trae el pedido completo con `clientes / empleados / venta_detalles / productos` e invoca `imprimirPickingMostrador(adaptarVentaParaPicking(data))`.
  - Mantiene `editingPedidoId` / `editingPedidoEstado` (no limpia el carrito): la cajera sigue viendo el pedido abierto.
  - `bumpPedidosPanel()` para refrescar el total en la lista lateral.

- En el bloque de botones (`editingPedidoId && editingPedidoEstado === 'en_preparacion'`), pasar de un solo botón "Confirmar preparado" (col-span-2) a **dos botones lado a lado**:
  - `Actualizar y reimprimir picking` (variant `outline`, con ícono `Printer`).
  - `Confirmar preparado` (variant `default`, con ícono `Check`).

  El contenedor pasa de `grid-cols-1` a `grid-cols-2` sólo para este caso (el flujo de borrador queda como está: un único botón "Enviar a preparar" en 1 columna).

- Estado `actualizandoPicking` para deshabilitar el botón mientras corre.

## Fuera de alcance

- No se cambia la lógica de `Confirmar preparado` ni la de `Enviar a preparar`.
- No se toca el layout del ticket de picking (`imprimirPickingMostrador`).
- No se agregan campos nuevos a `ventas` ni auditoría específica de reimpresiones (si más adelante hace falta rastrearlas, se hace aparte).
