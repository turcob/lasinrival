

## Análisis: Pedidos duplicados del mismo vendedor/cliente/día

### Estado actual

Revisé la lógica completa del módulo de pedidos y encontré lo siguiente:

1. **No existe ninguna validación ni unificación automática** de pedidos. Cuando un vendedor crea un pedido, se inserta directamente sin verificar si ya existe otro pedido pendiente del mismo cliente en el mismo día.

2. **No existe funcionalidad de edición de pedidos pendientes.** Un vendedor solo puede "Editar Preparación" cuando el pedido ya está en estado `preparado`, pero no puede agregar productos a un pedido `pendiente` existente.

3. **Consecuencia directa:** Si un vendedor carga 2 pedidos del mismo cliente el mismo día, se generan 2 pedidos independientes → 2 ventas → 2 movimientos en cuenta corriente → potencialmente activa el bloqueo automático por facturas adeudadas.

### Plan de implementación

Se proponen **dos mecanismos complementarios**:

#### 1. Detección y alerta al crear pedido
Al seleccionar un cliente en `NuevoPedidoDialog`, consultar si ya existe un pedido `pendiente` del mismo cliente en el día de hoy. Si existe:
- Mostrar un alert amarillo: "Este cliente ya tiene un pedido pendiente (#XXX) cargado hoy. Podés editarlo en lugar de crear uno nuevo."
- Ofrecer un botón "Editar pedido existente" que abra el pedido existente para agregar productos.
- Permitir igualmente crear uno nuevo si el usuario lo desea (con confirmación).

#### 2. Edición de pedidos pendientes (agregar/quitar productos)
Crear la funcionalidad para que un vendedor pueda modificar un pedido en estado `pendiente`:
- Nuevo componente `EditarPedidoDialog` que cargue los detalles actuales del pedido y permita agregar productos, cambiar cantidades o eliminar líneas.
- Al guardar: actualizar `pedido_detalles` (insert nuevos, update existentes, delete eliminados) y recalcular `subtotal`/`total` del pedido.
- Accesible desde `DetallePedidoDialog` cuando el estado es `pendiente`.

#### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/pedidos/NuevoPedidoDialog.tsx` | Query de pedido existente del mismo cliente hoy + alerta + botón |
| `src/components/pedidos/EditarPedidoDialog.tsx` | **Nuevo** - Dialog para editar pedido pendiente (agregar/quitar productos) |
| `src/hooks/usePedidos.ts` | Nuevo hook `useEditarPedido` para actualizar detalles |
| `src/components/pedidos/DetallePedidoDialog.tsx` | Botón "Editar Pedido" para estado `pendiente` |
| `src/pages/Pedidos.tsx` | Integrar `EditarPedidoDialog` |

No se requieren cambios de base de datos, la estructura actual de `pedidos` y `pedido_detalles` ya soporta estas operaciones.

