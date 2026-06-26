
# Refactor del POS — Venta atómica sin huérfanas

## Problema actual

Hoy el flujo del POS hace ~6 a 10 operaciones independientes contra la base, una tras otra, sin transacción global:

```text
1. RPC crear_venta_completa  → INSERT ventas + venta_detalles + venta_pagos
2. INSERT transferencias     (si hay transferencia)
3. INSERT cheques            (si hay cheque)
4. UPDATE productos.stock + INSERT movimientos_inventario (por item)
5. INSERT empleado_movimientos (si CC empleado)
6. INSERT movimientos_caja
7. INSERT cliente_movimientos (si CC cliente)
8. UPDATE cajas.total_ingresos
9. (luego) INSERT comprobantes_afip si factura
```

La RPC `crear_venta_completa` **sí** es atómica para venta+detalles+pagos, pero **solo** se usa en la rama de "venta nueva". En la rama de "editar pedido" (`editingPedidoId`), los pagos se insertan **después** del UPDATE de venta, sin transacción → si falla cualquier paso intermedio queda la venta sin pagos.

Además, ni siquiera la RPC abarca `movimientos_caja`, `transferencias`, `cheques`, `cliente_movimientos`, `empleado_movimientos`, `movimientos_inventario` ni la actualización del total de caja. Cualquier corte de red o error de validación entre paso 1 y paso 6 deja la venta confirmada **sin método de pago registrado** — exactamente lo que pasó con la venta #6047.

## Objetivo

Que la venta sea **todo o nada**: si falla cualquier paso financiero (pagos, caja, transferencia, cheque, CC), no queda registro de venta en la base. Si todo OK, la venta queda completa y consistente.

## Estrategia

Expandir la RPC existente `crear_venta_completa` a una nueva `pos_registrar_venta` que reciba el payload completo y haga todo en una sola transacción Postgres (que es atómica por defecto).

### Lo que entra en la RPC (transaccional)

- `INSERT ventas` + asignación de número
- `INSERT venta_detalles`
- `INSERT venta_pagos` (siempre, incluso en edición de pedido)
- `INSERT movimientos_caja` (ingreso por el total)
- `UPDATE cajas.total_ingresos`
- `UPDATE productos.stock_actual` + `INSERT movimientos_inventario` por item
- `INSERT transferencias` (si aplica, estado `pendiente`) — sin la foto, esa va aparte
- `INSERT cheques` (si aplica)
- `INSERT cliente_movimientos` (si CC cliente)
- `INSERT empleado_movimientos` (si CC empleado)
- Si es edición de pedido: `UPDATE ventas` + `DELETE venta_detalles` + reinsertar

Si **cualquier** insert falla, Postgres revierte todo y la venta no existe.

### Lo que queda fuera de la RPC (no transaccional, post-commit)

- Upload de la foto del comprobante de transferencia a Storage (no se puede hacer dentro de SQL). Se sube **antes** de llamar a la RPC y se pasa el `path` resultante como parámetro. Si la subida falla, se aborta la venta antes de tocar la base.
- Emisión AFIP (CAE) y `INSERT comprobantes_afip`: se mantiene **después** del commit, porque depende de un servicio externo y no debe bloquear la venta. Si AFIP falla, la venta queda registrada y se puede reintentar (ya existe `handleReintentarAfip`).
- Impresión del ticket (post-commit).

## Cambios concretos

### 1. Migración: nueva RPC `pos_registrar_venta`

Una sola función `SECURITY DEFINER` que recibe:

```text
p_venta            jsonb   -- datos de la venta
p_detalles         jsonb   -- array de items
p_pagos            jsonb   -- array de pagos
p_movimientos_inv  jsonb   -- array de movimientos de inventario a registrar
p_transferencia    jsonb   -- null o datos de transferencia
p_cheque           jsonb   -- null o datos de cheque
p_cliente_mov      jsonb   -- null o movimiento CC cliente
p_empleado_mov     jsonb   -- null o movimiento CC empleado
p_editing_pedido_id uuid   -- null o id de pedido a actualizar
```

Devuelve `{ id, numero_comprobante }`. Toda la lógica corre en la misma transacción implícita de la función.

### 2. `src/pages/POS.tsx`

- Reemplazar las llamadas separadas (RPC + transferencias + cheques + cliente_movimientos + empleado_movimientos + movimientos_caja + UPDATE cajas + movimientos_inventario + UPDATE productos) por **una sola** llamada a `pos_registrar_venta`.
- Subir la foto de transferencia **antes** de invocar la RPC y pasar el `path` como parámetro.
- Mantener fuera del RPC: emisión AFIP, impresión, refresco de caja en el cliente.
- Las tres ramas actuales (venta empleado / venta cliente CC / venta normal) consolidan su lógica en armar el payload y llamar a la misma RPC.

### 3. Sin cambios funcionales visibles

El usuario no nota ninguna diferencia en la UI. El único efecto observable es que **dejan de aparecer ventas sin método de pago**: o se registra completa o no se registra.

## Limpieza del histórico

Aparte del refactor, se puede:
- Anular la venta #6047 actual (queda con `anulada=true`, motivo "venta huérfana sin pago").
- Opcional: query de auditoría para listar otras posibles huérfanas históricas (ventas confirmadas no anuladas sin filas en `venta_pagos`).

## Riesgos

- La RPC se vuelve más grande y centraliza mucha lógica de negocio. Mitigación: mantenerla acotada a inserts/updates, sin reglas de pricing ni descuentos (eso sigue en el cliente).
- Stock: el `UPDATE productos.stock_actual` dentro de la RPC debe leer el stock con `FOR UPDATE` para evitar condiciones de carrera entre ventas concurrentes del mismo producto.
- Permisos: la RPC corre como `SECURITY DEFINER`, así que valida `auth.uid()` al inicio y respeta los permisos de caja/venta del usuario.

## Pasos de implementación

1. Migración SQL con la nueva función `pos_registrar_venta` (y mantener la vieja `crear_venta_completa` por compatibilidad hasta confirmar).
2. Refactor de `src/pages/POS.tsx` en las tres ramas de venta.
3. Anular venta #6047 huérfana.
4. Verificación: hacer una venta efectivo, una con transferencia, una a CC cliente, una a CC empleado, y forzar un error intermedio para confirmar el rollback.
