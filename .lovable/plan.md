Copiá y pegá este prompt en Antigravity:

```md
# Corrección urgente: diferencia de caja por pago duplicado en venta/pedido #6404

Necesito corregir una diferencia de caja de aproximadamente $218.000 generada por un pago duplicado. El efectivo fue entregado una sola vez, pero el sistema lo registró dos veces.

## Contexto del problema

Hay una venta/pedido con comprobante/remito **#6404**.

La venta real fue una sola operación por aproximadamente:

- Total venta: **$218.775,89**
- Subtotal: **$218.775,92**
- La diferencia de $0,03 es solo redondeo y NO es el problema.

El problema real es que se duplicó el pago en efectivo y también el movimiento de caja:

- En `venta_pagos` hay dos pagos iguales para la misma venta.
- En `movimientos_caja` hay dos ingresos iguales para la misma venta.
- Ambos registros duplicados tienen monto aproximado **$218.775,89**.
- Se crearon con 1 segundo de diferencia.
- Eso infló la caja como si se hubiera recibido dos veces el efectivo.

La venta relacionada es:

- `ventas.id`: `20b16f5f...`
- Comprobante: `6404`
- Pago duplicado detectado previamente:
  - `venta_pagos.id` duplicado: `11b6c710...`
  - `movimientos_caja.id` duplicado: `f866746a...`

Si los IDs completos no están disponibles en el entorno, identificar los duplicados por:

- misma `venta_id`
- mismo `monto`
- misma forma de pago efectivo
- timestamps casi iguales
- mismo concepto o referencia de venta

## Objetivo

Corregir el sistema para que:

1. La caja deje de mostrar el ingreso duplicado.
2. La venta #6404 quede con un solo pago real.
3. El movimiento de caja quede con un solo ingreso real.
4. El total de caja se reduzca exactamente por el monto duplicado.
5. El bug no vuelva a ocurrir si se procesa/edita/reintenta un pedido convertido a venta.

## Importante

No anular la venta.
No borrar el pago real.
No modificar productos, clientes, deuda ni stock salvo que se detecte que también se duplicaron por el mismo bug.
No tocar facturación AFIP si no está involucrada.
No cambiar el total de la venta.
No corregir el redondeo de $0,03.

## Diagnóstico técnico esperado

Revisar la función/RPC equivalente a `pos_registrar_venta`.

El bug suele estar en el flujo de edición/reprocesamiento de pedido existente, por ejemplo cuando existe un parámetro similar a:

- `p_editing_pedido_id`
- `editingPedidoId`
- `pedido_id`
- conversión de pedido a venta

El error esperado es que al reprocesar una venta/pedido existente se borran los detalles (`venta_detalles`) pero NO se borran los pagos (`venta_pagos`) ni los movimientos asociados (`movimientos_caja`). Entonces, cada reintento vuelve a insertar pagos y movimientos, acumulándolos.

También revisar el frontend del POS: un botón de confirmar venta puede dispararse dos veces si solo usa estado React (`useState`) como guard, porque el estado es asincrónico y puede no bloquear doble click rápido.

## Corrección de datos para #6404

Antes de borrar nada, ejecutar consultas SELECT para confirmar:

```sql
SELECT id, numero_comprobante, total, subtotal, estado, caja_id, fecha
FROM ventas
WHERE numero_comprobante = 6404;
```

Luego consultar pagos:

```sql
SELECT vp.id, vp.venta_id, vp.forma_pago_id, fp.nombre AS forma_pago, vp.monto, vp.created_at
FROM venta_pagos vp
LEFT JOIN formas_pago fp ON fp.id = vp.forma_pago_id
WHERE vp.venta_id = '<VENTA_ID_DE_6404>'
ORDER BY vp.created_at;
```

Consultar movimientos de caja:

```sql
SELECT id, caja_id, venta_id, tipo, concepto, monto, created_at
FROM movimientos_caja
WHERE venta_id = '<VENTA_ID_DE_6404>'
ORDER BY created_at;
```

Si se confirman exactamente dos pagos iguales y dos ingresos iguales, conservar el primero y eliminar solo el duplicado.

Ejemplo de corrección:

```sql
-- borrar solo el pago duplicado, no el pago real
DELETE FROM venta_pagos
WHERE id = '<ID_PAGO_DUPLICADO>';

-- revertir el total inflado de la caja antes o junto con borrar el movimiento duplicado
UPDATE cajas c
SET total_ventas = COALESCE(c.total_ventas, 0) - m.monto
FROM movimientos_caja m
WHERE m.id = '<ID_MOVIMIENTO_CAJA_DUPLICADO>'
  AND c.id = m.caja_id;

-- borrar solo el movimiento de caja duplicado
DELETE FROM movimientos_caja
WHERE id = '<ID_MOVIMIENTO_CAJA_DUPLICADO>';
```

Verificar después:

```sql
SELECT COUNT(*) AS pagos, SUM(monto) AS total_pagos
FROM venta_pagos
WHERE venta_id = '<VENTA_ID_DE_6404>';

SELECT COUNT(*) AS movimientos, SUM(monto) AS total_movimientos
FROM movimientos_caja
WHERE venta_id = '<VENTA_ID_DE_6404>'
  AND tipo = 'ingreso';

SELECT id, total_ventas
FROM cajas
WHERE id = '<CAJA_ID>';
```

El resultado esperado es:

- 1 solo pago real para la venta #6404.
- 1 solo movimiento de caja real para la venta #6404.
- `cajas.total_ventas` reducido en el monto duplicado, aproximadamente $218.775,89.

## Corrección permanente del bug

Modificar la función/RPC que registra ventas para que sea idempotente cuando reprocesa una venta/pedido existente.

En la rama donde se actualiza una venta existente, antes de reinsertar datos:

1. Guardar el total de movimientos de caja previos vinculados a esa venta.
2. Restar esos movimientos previos de `cajas.total_ventas`.
3. Borrar pagos previos de la venta.
4. Borrar movimientos de caja previos de la venta.
5. Borrar o revertir otros movimientos previos relacionados solo si esa función los vuelve a insertar:
   - `movimientos_inventario`
   - `cliente_movimientos`
   - `empleado_movimientos`
   - `transferencias`
   - `cheques`
6. Reinsertar el estado correcto una sola vez.

Pseudocódigo esperado:

```sql
IF editing_existing_sale THEN
  UPDATE ventas ... RETURNING id INTO v_venta_id;

  DELETE FROM venta_detalles WHERE venta_id = v_venta_id;

  -- revertir caja previa
  UPDATE cajas c
  SET total_ventas = GREATEST(COALESCE(c.total_ventas, 0) - prev.total, 0)
  FROM (
    SELECT caja_id, SUM(monto) AS total
    FROM movimientos_caja
    WHERE venta_id = v_venta_id
      AND tipo = 'ingreso'
    GROUP BY caja_id
  ) prev
  WHERE c.id = prev.caja_id;

  DELETE FROM venta_pagos WHERE venta_id = v_venta_id;
  DELETE FROM movimientos_caja WHERE venta_id = v_venta_id;

  -- si corresponde por la lógica existente:
  -- revertir stock de movimientos_inventario anteriores y borrarlos
  -- borrar cliente_movimientos / empleado_movimientos vinculados a venta_id
  -- borrar transferencias / cheques vinculados a venta_id
END IF;
```

## Corrección frontend anti doble click

En el POS o pantalla que confirma ventas, no depender solo de `useState` para `emitiendo`/`procesando`.

Agregar un guard sincrónico con `useRef`:

```tsx
const emitiendoRef = useRef(false);

const handleProcesarVenta = async () => {
  if (emitiendoRef.current) return;
  emitiendoRef.current = true;
  setEmitiendo(true);

  try {
    // registrar venta
  } finally {
    emitiendoRef.current = false;
    setEmitiendo(false);
  }
};
```

Aplicar el mismo patrón a todas las variantes de procesamiento:

- venta normal/directa
- venta a cuenta corriente de cliente
- venta a cuenta corriente de empleado
- cualquier handler que llame al registro de venta/pedido

## Validación final

Después de implementar, validar:

1. La venta #6404 tiene un solo pago.
2. La venta #6404 tiene un solo movimiento de caja.
3. La caja ya no tiene la diferencia extra de aproximadamente $218.775,89.
4. Si se reprocesa/edita el mismo pedido, no se duplican pagos ni movimientos.
5. Si se hace doble click rápido en confirmar venta, no se generan duplicados.

## Criterio de aceptación

La diferencia de caja causada por el duplicado debe desaparecer.
El sistema debe reflejar que el efectivo se recibió una sola vez.
La venta debe seguir existiendo normalmente.
No debe alterarse el remito, factura, cliente, deuda o stock salvo que se confirme duplicación asociada.
```
