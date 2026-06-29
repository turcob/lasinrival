## Objetivo

Eliminar la elección manual de resolución financiera en el wizard de Nota de Crédito. La resolución se determina automáticamente según el cliente y el método de pago original de la venta, y el popup pasa a ser solo informativo (salvo selección de caja para admin).

## Reglas de resolución automática

| Caso | Detección | Acción automática |
|---|---|---|
| 1. Cliente final (consumidor final / sin cliente_id) | `venta.cliente_id IS NULL` o cliente Consumidor Final | **Egreso en caja** |
| 2. Cliente con pago directo | Existe `cliente_id` y NO hay `venta_pagos` con forma de pago "Cuenta Corriente" | **Egreso en caja** |
| 3. Cliente con pago en Cuenta Corriente | `venta_pagos` con forma de pago "Cuenta Corriente" | **Crédito en CC del cliente** (movimiento NCR) |

## Reglas de selección de caja (cuando la resolución es egreso en caja)

| Rol del usuario | Comportamiento |
|---|---|
| **Vendedor** (o cualquier rol no admin) | Egreso se registra **automáticamente en SU caja abierta**. Sin selector. Si no tiene caja abierta → error y abortar resolución. |
| **Administrador** | Por defecto se selecciona **su propia caja abierta**, pero el popup informativo muestra un selector con **todas las cajas abiertas** del día para que pueda cambiarla antes de confirmar. |

## UI — `src/components/facturacion/NotaCreditoParcialWizard.tsx`

1. Quitar el paso manual de elegir "Egreso en Caja" vs "Crédito en CC".
2. Calcular la resolución apenas se carga la factura/venta origen (helper `determinarResolucionAutomatica`).
3. Tras emitir ARCA con éxito, mostrar **popup informativo** con:
   - Tipo de resolución (Caja X / Crédito en CC cliente Y) y motivo de la regla aplicada.
   - Monto.
   - **Si es egreso y el usuario es admin**: selector de caja (default = caja propia abierta). Botón "Confirmar resolución".
   - **Si es egreso y el usuario es vendedor**: solo lectura con la caja propia. Botón "Aceptar" que confirma.
   - **Si es CC**: solo lectura. Botón "Aceptar".
4. Si vendedor no tiene caja abierta → toast de error y bloquear emisión antes de tocar ARCA (validación previa).
5. Si admin no tiene caja propia abierta pero existen otras → mostrar selector sin default y exigir elección.

## Backend

Sin migraciones de esquema. Reusar campos existentes en `comprobantes_afip` (`resolucion_financiera`, `caja_movimiento_id`, `resolucion_cliente_movimiento_id`, `resolucion_at`, `resolucion_por`).

Consultas adicionales en el cliente:
- `venta_pagos` + `formas_pago` para detectar pago CC.
- `cajas` filtrado por `estado = 'abierta'` y fecha de hoy para listar opciones (admin) y resolver caja propia (vendedor/admin) vía `usuario_apertura_id = user.id`.

## Detalles técnicos

- **Cliente final**: `cliente_id IS NULL` o `clientes.condicion_iva` = Consumidor Final (verificar campo en tabla).
- **Pago CC**: `formas_pago.nombre ILIKE '%cuenta corriente%'`.
- **Caja propia**: registro en `cajas` con `usuario_apertura_id = auth.uid()` y sin cierre.
- **Movimiento caja**: tipo `egreso`, concepto `NC <numero> - Factura <numero_origen>`, actualiza `cajas.total_egresos`.
- **Movimiento CC**: tipo `NCR`, asociado al `cliente_id`.
- Rol se obtiene desde `useAuth().hasRole('admin')`.

## Fuera de alcance

- No cambia lógica de emisión ARCA ni items de la NC.
- No se toca flujo de anulación total automática desde Ventas.
- No se modifican permisos ni RLS.
