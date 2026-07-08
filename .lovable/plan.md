# Diagnóstico: Duplicación de pago en venta #00006404

## Qué pasó

Consultando la base:

- **Venta única** `20b16f5f…` #6404, `total=218.775,89`, `subtotal=218.775,92`, creada **11:18:02** (nació como pedido).
- **Dos filas idénticas** en `venta_pagos` (Efectivo, $218.775,89) creadas a las **11:48:31** y **11:48:32** (1 segundo de diferencia).
- **Dos filas idénticas** en `movimientos_caja` (ingreso $218.775,89) a las mismas timestamps.

Es decir: la venta empezó como *pedido* a las 11:18, y a las 11:48 al cobrarla el RPC `pos_registrar_venta` se ejecutó **dos veces** en 1 segundo (doble click / doble emisión desde el diálogo de cobro). Por eso ves duplicado el "Efectivo" en el comprobante y esa diferencia de $0,03 entre subtotal y total es sólo el redondeo original — el "error visible" es la duplicación de la forma de pago.

## Por qué el RPC no lo evitó

En `pos_registrar_venta`, cuando viene `p_editing_pedido_id` (cobrar un pedido existente):

```
UPDATE ventas …
DELETE FROM venta_detalles WHERE venta_id = v_venta_id;   -- ✅ limpia detalles
-- ❌ NO borra venta_pagos previos
-- ❌ NO borra movimientos_caja previos
INSERT INTO venta_pagos …                                 -- agrega otra tanda
INSERT INTO movimientos_caja …                            -- agrega otra tanda
```

Cualquier reintento sobre un pedido en edición **acumula** pagos y movimientos de caja en vez de reemplazarlos. Sumado a que el guard `emitiendo` del cliente es un `useState` (asíncrono) y no bloquea un segundo click disparado antes del re-render.

## Plan de fix

### 1. Hacer idempotente el RPC (`pos_registrar_venta`) — migración SQL

En la rama `IF p_editing_pedido_id IS NOT NULL`, antes de re-insertar:

```sql
DELETE FROM venta_pagos      WHERE venta_id = v_venta_id;
DELETE FROM movimientos_caja WHERE venta_id = v_venta_id;
-- (venta_detalles ya se borra)
```

Así, reprocesar un pedido siempre deja el estado consistente aunque el cliente reintente.

### 2. Guard duro anti doble-click en el cliente

En `src/pages/POS.tsx`, reemplazar el guard basado sólo en `useState('emitiendo')` por un `useRef` (`emitiendoRef.current`) chequeado al inicio de:

- `handleProcesarVenta`
- `handleProcesarVentaClienteCC`
- `handleProcesarVentaEmpleadoCC`

El `useRef` se actualiza de forma síncrona y bloquea el segundo disparo aunque React no haya re-renderizado el `disabled` del botón.

### 3. Corregir la venta #6404 ya existente — migración de datos

Borrar la fila duplicada (la de las 11:48:32) tanto en `venta_pagos` como en `movimientos_caja`:

```sql
DELETE FROM venta_pagos      WHERE id = '11b6c710-c1b0-4d7a-a9a4-e5f32fb43a3c';
DELETE FROM movimientos_caja WHERE id = 'f866746a-c71f-4e04-811c-7480415a187c';
```

El `total` de la venta ya es correcto ($218.775,89); no requiere recalcularse.

### 4. Verificación

- Re-abrir el comprobante #6404 → debe mostrar una sola línea "Efectivo $218.775,89".
- Revisar rendición de la caja del 06/07 → el total baja $218.775,89 y coincide con lo real.
- Simular doble-click al confirmar un pedido → sólo se registra una tanda de pagos/movimientos.

## Nota sobre la diferencia $0,03 (218.775,92 vs 218.775,89)

Es sólo redondeo del subtotal por líneas (31.093,00 + 13.840,93 + 7.580,32 = 218.514,25 no cierra con los precios unitarios porque hay bonificación/redondeo por línea). No es un bug de duplicación; el bug real es la doble forma de pago. Si querés que también unifique el criterio de redondeo, avisame y lo agrego como fix separado.
