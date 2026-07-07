# Fix: Recargo por cuotas trasladado al cliente

## Problema
Al pagar con tarjeta con coeficiente > 1 (ej. Tarjeta Sol 2 cuotas al 8%), el sistema multiplica el monto ingresado por el coeficiente pero **no actualiza el Total a cobrar**, lo que genera un "Excedente" que bloquea el botón Continuar.

Ejemplo actual:
- Total: $39.086.627
- Monto tarjeta ingresado: $39.086.627 → almacenado como $42.213.557
- Excedente: $3.126.930 → no deja continuar

## Solución
El recargo se traslada al cliente: cuando hay al menos un pago con tarjeta y coeficiente > 1, el **Total a cobrar del modal Forma de Pago** se recalcula sumando el recargo (monto × (coef − 1)) de cada pago con tarjeta. Así el Total pagado coincide con el nuevo total y desaparece el excedente.

## Cambios (solo `src/pages/POS.tsx`)

1. **Nuevo cálculo `totalConRecargo`** (memoizado):
   - Base = `total` (subtotal actual de la venta).
   - Suma de recargos = Σ `pago.monto − pago.monto/coeficiente` de los pagos con `tarjeta_id` y `coeficiente > 1`.
   - `totalConRecargo = total + suma_recargos`.

2. **Modal Forma de Pago**:
   - Mostrar "Total a cobrar" = `totalConRecargo`.
   - Debajo, si hay recargo, línea informativa: `Recargo por cuotas: $X`.
   - Pendiente / Excedente / disabled del botón Continuar comparan contra `totalConRecargo` en vez de `total`.

3. **Validaciones de importes** que hoy usan `total - totalPagado` (efectivo, transferencia, cheque, QR, botón "usar pendiente"):
   - Reemplazar por `totalConRecargo - totalPagado` para que el resto de las formas de pago vean el pendiente correcto tras aplicarse el recargo.

4. **`handleAddPagoTarjeta`**: sin cambios de lógica (sigue guardando `monto × coeficiente` como monto efectivo cobrado); el recargo se refleja automáticamente al recalcular `totalConRecargo`.

5. **Persistencia / AFIP** (`handleContinuarPago` y `pos_registrar_venta`):
   - Enviar el `total` de la venta ya con recargo cuando existan pagos con coeficiente. El detalle de items no cambia; el recargo se incluye como un ítem "Recargo financiación" o como ajuste al total de la venta, según lo que soporte el RPC actual.
   - Revisar `pos_registrar_venta` para confirmar que acepta `total` distinto a la suma de items. Si no, se agrega un item virtual "Recargo por cuotas" con importe = suma de recargos y cantidad 1 (sin afectar stock).

## Verificación
- Reproducir el caso de la captura (Total 39.086.627, Tarjeta Sol 2 cuotas 8%): el modal debe mostrar Total 42.213.557, Total pagado 42.213.557, sin excedente, botón Continuar habilitado.
- Ticket / factura AFIP debe emitirse por 42.213.557 con línea de recargo visible.
- Pago mixto (parte efectivo + parte tarjeta con recargo) debe calcular pendiente correctamente para el efectivo.
