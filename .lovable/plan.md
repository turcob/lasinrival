
# Rediseño del flujo Mostrador en Punto de Venta

## Objetivo
Modelar en el POS el flujo real del mayorista presencial:
**Armar → imprimir picking → preparar (ajustar unidades / anotar peso real) → cobrar**, con múltiples borradores conviviendo al mismo tiempo.

Se mantiene el flujo actual (Pedido POS sobre `ventas.estado='pedido'`) pero se lo transforma en un circuito de tres estados con UI clara. NO se toca el flujo mayorista de reparto (tabla `pedidos`), ni el botón "Cobrar pedido preparado" que ya activamos.

---

## Nuevo circuito de un Pedido de Mostrador

```
[Borrador]  →  [En preparación]  →  [Preparado]  →  [Cobrado]
    ^              (imprime           (listo             (venta
    |               picking)           para cobrar)       confirmada)
    └── editable libremente ─┘                └── carrito bloqueado ──┘
```

- **Borrador**: el operador arma el carrito y lo guarda. Editable, sin imprimir. Igual al "Pedido POS" de hoy.
- **En preparación**: se imprime el ticket de picking y el pedido queda "en depósito". El operador del POS puede seguir atendiendo otros clientes; los borradores conviven en un panel lateral.
- **Preparado**: al volver el preparador con la mercadería, desde el POS se abre el pedido y se ajustan cantidades reales (unidades) y precios/subtotales (kg pesados). Se marca preparado.
- **Cobrado**: se toca "Cobrar" y se dispara el flujo de pagos normal (efectivo, tarjeta, transferencia, CC). La venta se confirma y numera.

Cancelar en cualquier estado previo repone stock si ya se había descontado (hoy no se descuenta hasta cobrar; se mantiene así).

---

## Cambios en la interfaz del POS

### 1. Panel lateral "Pedidos en curso"
Reemplaza al botón "Ver Pedidos" que abre diálogo. En lugar de un modal, un panel siempre visible (colapsable en mobile) que lista los borradores del día agrupados por estado con badge de color:

- Amarillo: Borrador
- Naranja: En preparación
- Verde: Preparado (listo para cobrar)

Cada tarjeta muestra: cliente, cantidad de items, total estimado, hora, y botón principal según estado (Editar / Ver ticket / Cobrar). Click en la tarjeta lo carga en el carrito.

Multiselección visual clara para tener varios pedidos abiertos en paralelo.

### 2. Botones del carrito rediseñados
Se simplifican los dos botones actuales ("Pedido" + "Ver Pedidos") en uno solo contextual:

- Carrito vacío + ningún borrador cargado: sin acción de pedido.
- Carrito con items sin cargar: **Guardar como borrador**.
- Editando borrador: **Actualizar borrador** / **Enviar a preparar**.
- Editando preparación: **Confirmar preparado**.
- Editando preparado: **Cobrar** (ya está el botón grande de siempre).

Cartel de contexto arriba del carrito con el estado actual y botón X para descartar cambios.

### 3. Diálogo de preparación desde el POS
Al abrir un pedido en estado "En preparación", en vez de cargar todo al carrito editable se abre una vista dedicada con tabla:

| Producto | Unidad | Cant. pedida | Cant. real | Precio unit. | Subtotal |
|----------|--------|--------------|------------|--------------|----------|
| Muslo pollo | kg | 5 kg | [input] | [input] | auto |
| Coca 2.25 | u | 6 u | [input] | fijo | auto |

- Items por unidad: input numérico para ajustar cantidad, precio bloqueado.
- Items por peso (`es_pesable` / unidad kg): inputs de cantidad **y** precio unitario editable (el peso real cambia el subtotal, no el precio del catálogo).
- Botón "Marcar preparado" al final. Recalcula totales antes de pasar al cobro.

Se aprovecha la lógica de pesaje que ya usa `PrepararPedidoDialog` del módulo Pedidos (parsing decimal para KG), portada como componente compartido.

### 4. Ticket de picking mejorado
El `handleImprimirPedido` actual muestra precios; se reemplaza (en el paso "Enviar a preparar") por un ticket de picking sin precios:

- Encabezado: #Pedido, hora, cliente, operador
- Tabla por item con columnas: **Código | Descripción | Unidad | Cant. pedida | ☐ Preparado | Peso/Cant. real ___ | $ Precio ___**
- Los últimos dos campos son líneas en blanco para escribir a mano en el papel.
- Sin total, sin subtotales por línea.
- Pie: espacio para firma del preparador.

Se puede reimprimir desde la tarjeta del panel lateral en cualquier momento.

---

## Cambios técnicos (para revisión)

### Base de datos
- Reutilizar `ventas.estado`. Ampliar el CHECK/enum para aceptar: `pedido` (borrador), `en_preparacion`, `preparado` además de `confirmada`, `anulada`.
- Nuevo campo `ventas.preparado_at` y `ventas.preparado_por` para trazabilidad.
- El trigger `ventas_asignar_numero_comprobante` sigue asignando número **solo al pasar a `confirmada`**, no antes. Estados intermedios no consumen numeración.
- `venta_detalles` ya acepta cantidad y precio libres — no requiere cambios de esquema. El "precio del catálogo" para pesables se guarda como referencia; el precio efectivo lo escribe el operador.

### Backend
- Nueva RPC `pos_actualizar_pedido_estado(p_venta_id, p_nuevo_estado, p_detalles)` que:
  - Valida transición legal (borrador→en_preparacion→preparado, o borrador→cancelado).
  - Reemplaza `venta_detalles` con los detalles ajustados (para el paso preparado).
  - Escribe `preparado_at`/`preparado_por` cuando corresponda.
  - Nunca descuenta stock (eso lo sigue haciendo `pos_registrar_venta` en la confirmación).
- `pos_registrar_venta` ya soporta `p_editing_pedido_id` — se extiende para aceptar también `en_preparacion` y `preparado` como estado anterior válido al confirmar.

### Frontend
- Componente nuevo `PedidosMostradorPanel.tsx` (panel lateral).
- Componente nuevo `PrepararMostradorDialog.tsx` (tabla de ajuste).
- Utilidad nueva `imprimirPickingMostrador.ts` para el ticket sin precios.
- Refactor de los handlers de `POS.tsx`: `handleGuardarPedido`, `handleCargarPedido` y `handleEliminarPedido` se extienden con los nuevos estados; se elimina el modal "Ver Pedidos" y el toast informativo.
- Filtro por estado y refresco automático del panel cada 30 s (o con `postgres_changes` si ya hay realtime en la pantalla).

### Compatibilidad y datos existentes
- Los borradores actuales (hay N filas en `ventas` con `estado='pedido'`) siguen apareciendo como Borrador — sin migración de datos.
- El flujo de reparto mayorista y "Cobrar pedido preparado" no se ven afectados: son tabla `pedidos`, no `ventas`.

---

## Alcance del cambio

Incluido:
- Panel lateral y rediseño de botones del carrito
- Diálogo de preparación con pesaje
- Nuevo ticket de picking sin precios
- Nueva RPC y ampliación del enum/CHECK de `ventas.estado`
- Integración con `pos_registrar_venta` existente

No incluido (queda para otra iteración si hace falta):
- Notificaciones push al preparador
- Múltiples preparadores simultáneos con asignación
- Impresión automática en impresora de depósito (por ahora se sigue mandando al navegador)
- Cambios en el flujo de reparto o en `Cobrar pedido preparado` mayorista
