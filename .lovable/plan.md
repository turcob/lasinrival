## Objetivo
Eliminar el popup (`SelectorTipoPedidoDialog`) y el selector desplegable de tipo de pedido en la pantalla de Pedidos. Reemplazarlos por **pestañas** para alternar entre "Pedidos Web", "Pedidos de Reparto" y "Consolidado".

## Cambios (solo frontend)

### 1. `src/pages/Pedidos.tsx`
- Reestructurar el `<Tabs>` existente para incluir tres pestañas en lugar de dos:
  - **Pedidos Web** (icono Globe, color rojo)
  - **Pedidos de Reparto** (icono Truck, color azul)
  - **Consolidado**
- Eliminar `<SelectorTipoPedidoDialog />` del render.
- Reemplazar el uso de `useTipoPedido()` por un estado local `tipoPedidoTab` (`'web' | 'reparto'`) que se sincroniza con la pestaña activa.
- Pasar `tipoPedido: tipoPedidoTab` a `usePedidos({...})`.
- Quitar el componente `<TipoPedidoSelector />` de la toolbar (ya no es necesario).
- `TipoPedidoBadge` en la columna N° Pedido: mantenerlo o simplificarlo (opcionalmente quitarlo ya que la pestaña ya indica el tipo — lo mantendremos por claridad visual).

### 2. `src/contexts/TipoPedidoContext.tsx`
- Ya no necesario para esta pantalla, pero **no se elimina** por precaución (podría usarse en otros lugares). Se deja intacto.

### 3. `src/components/pedidos/SelectorTipoPedidoDialog.tsx` y `TipoPedidoSelector.tsx`
- Quedan huérfanos respecto a `Pedidos.tsx` pero no se eliminan (por si son referenciados en otro lado). Solo se dejan de renderizar.

## Comportamiento resultante
- Al entrar a `/pedidos`, ya no aparece el popup inicial.
- El usuario elige el tipo mediante las pestañas superiores.
- La pestaña por defecto será **Pedidos de Reparto** (comportamiento previsible para la mayoría del uso operativo). Si preferís que arranque en Web o recordar la última elección, avisame.

## Fuera de alcance
- No se toca la lógica de negocio ni `usePedidos`.
- No se cambia el diálogo `NuevoPedidoDialog` (ese sigue preguntando el tipo al crear).
- No se modifica la base de datos.
