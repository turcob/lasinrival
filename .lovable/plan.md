
## Rediseño POS con pestañas: Venta directa vs Pedidos mostrador

### Problema con la interfaz actual
- El panel lateral colapsable no tiene scroll adecuado y satura la vista del carrito.
- El botón "Imprimir picking" imprime pero no cambia el estado a `en_preparacion`, obligando a un segundo click.
- Todo convive en la misma pantalla — venta directa y pedidos mostrador — generando confusión visual entre dos botones que hacen cosas parecidas ("Guardar borrador" vs "Cobrar pedido preparado" mayorista).

### Nueva estructura: dos pestañas dentro de `/pos`

```text
┌─────────────────────────────────────────────────┐
│ [ Venta directa ]  [ Pedidos mostrador (3) ]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  contenido de la pestaña activa                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Pestaña 1 · Venta directa** (default)
- POS clásico tal como está hoy: buscar productos, armar carrito, cobrar (efectivo/tarjeta/transferencia/CC).
- Se quita el panel lateral de pedidos y los botones "Pedido" / "Ver Pedidos" / "Cobrar pedido preparado" (mayorista/logístico).
- Queda una UI limpia enfocada en el flujo rápido de mostrador presencial.

**Pestaña 2 · Pedidos mostrador**
Layout de dos columnas:

- **Izquierda — lista de pedidos en curso** (lo que hoy es el panel lateral, pero ahora ocupando su lugar natural, con scroll propio). Agrupa por estado con badges:
  - Amarillo · Borrador
  - Naranja · En preparación
  - Verde · Preparado (listo para cobrar)
  - Contador por grupo + botón "Nuevo pedido" arriba.
- **Derecha — área de trabajo del pedido activo**: muestra el carrito/editor del pedido seleccionado. Sin pedido seleccionado, un empty state con CTA "Nuevo pedido de mostrador".

Flujo dentro de la pestaña:
1. **Nuevo pedido**: se arma el carrito (mismo buscador que la venta directa, componente compartido). Botón principal **"Enviar a preparar"** que en un solo click guarda como `en_preparacion` **e imprime el picking** (los dos pasos juntos, como pidió el usuario). Botón secundario "Guardar borrador" para casos donde todavía no se manda a depósito.
2. **Editar borrador**: se abre en la misma columna derecha. Botón "Enviar a preparar" (guarda + imprime) o "Actualizar borrador".
3. **Confirmar preparado**: al seleccionar un pedido en `en_preparacion`, se abre el diálogo de ajuste actual (`PrepararMostradorDialog`) con la tabla de pesaje. Al confirmar pasa a `preparado`.
4. **Cobrar**: seleccionar un pedido `preparado` carga su contenido en la columna derecha (bloqueado, no editable) y activa el botón grande "Cobrar" que dispara el flujo de pagos existente (`pos_registrar_venta` con `p_editing_pedido_id`).

Cancelar / reimprimir picking siguen disponibles como acciones secundarias en cada tarjeta.

### Cambios técnicos

- `src/pages/POS.tsx`
  - Envolver el contenido actual en `<Tabs>` con dos `TabsContent`: `directa` y `mostrador`.
  - Extraer el carrito y sus handlers a componentes reutilizables (o pasarlos por props) para que ambas pestañas los compartan sin duplicar lógica.
  - Estado local `modoActivo: 'directa' | 'mostrador'` para condicionar qué botones muestra el carrito.
  - En modo `mostrador`, el botón principal del carrito se convierte en **"Enviar a preparar"** cuando hay items sin guardar; ese handler llama a `pos_actualizar_pedido_estado(..., 'en_preparacion', detalles)` y a continuación `imprimirPickingMostrador(...)` en una sola acción.
  - Sacar el `PedidosMostradorPanel` de la parte superior del carrito y moverlo a la columna izquierda de la pestaña mostrador. Ajustarle el `ScrollArea` con altura fija (`h-[calc(100vh-16rem)]` o similar) para que scrollee bien.
- `src/components/pos/PedidosMostradorPanel.tsx`
  - Modo "sidebar" (columna, no colapsable). Se elimina el `Collapsible` y el `Card` externo; queda un contenedor con header fijo (buscador/filtros) + `ScrollArea` con altura definida.
  - El botón "Imprimir picking" de cada tarjeta desaparece como acción aislada — sólo se conserva el "Reimprimir" para pedidos que ya están `en_preparacion` (porque en ese estado imprimir no cambia nada).

### No incluido

- No se toca la base de datos (los estados `en_preparacion`/`preparado` y la RPC `pos_actualizar_pedido_estado` ya están aplicados y funcionando).
- No se toca el flujo mayorista de reparto (tabla `pedidos`) ni el flag `pos_flujo_mayorista_activo` — ese botón "Cobrar pedido preparado" del mayorista logístico queda tal cual (¿lo movemos también a esta nueva pestaña o lo dejamos aparte? ver pregunta abajo).
- No se toca el flujo de pagos ni la RPC `pos_registrar_venta`.

### Pregunta abierta

El botón **"Cobrar pedido preparado"** del flujo mayorista logístico (tabla `pedidos`, activado con el flag) hoy está en el header del POS. ¿Lo dejamos en la pestaña "Venta directa" como está, o lo movemos también a la pestaña "Pedidos mostrador" para unificar todo lo que es "cobrar algo que ya viene preparado"? Mi recomendación: dejarlo en "Venta directa" porque los pedidos de reparto son otro circuito y mezclarlos confunde de nuevo. Confirmame antes de implementar.
