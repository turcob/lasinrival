## Objetivo

Emitir Notas de Crédito **parciales** (devolución o bonificación) sobre facturas ya autorizadas en ARCA desde **Facturación Electrónica**, sin anular la venta original, permitiendo múltiples NC por factura con trazabilidad completa.

## Base de datos

**Nueva tabla `nota_credito_items`** — vincula una NC (registro en `comprobantes_afip` con tipo 3/8/13) a los `venta_detalles` afectados:

```
- comprobante_nc_id      uuid  → comprobantes_afip(id)  (la NC)
- comprobante_factura_id uuid  → comprobantes_afip(id)  (la factura origen)
- venta_detalle_id       uuid  → venta_detalles(id)     (null si bonificación)
- producto_id            uuid
- cantidad               numeric
- precio_unitario        numeric
- importe                numeric
- reingresado_stock      boolean
- created_at             timestamptz
```

**Ampliación `comprobantes_afip`**:
- `motivo_nc text` (`devolucion`, `bonificacion`, `error_facturacion`, `otro`)
- `observaciones text`
- `tipo_nc text` (`total`, `parcial_items`, `parcial_bonificacion`)
- `factura_origen_id uuid → comprobantes_afip(id)` (para listar el árbol Factura → NCs)

**Ampliación `ventas`**:
- `monto_acreditado numeric default 0`
- `acreditada_parcial boolean default false`

Grants/policies: lectura `facturacion.ver`, escritura `facturacion.crear`.

**RPC `get_factura_saldo_disponible(comprobante_factura_id)`** — devuelve, por cada `venta_detalle`, `cantidad_facturada`, `cantidad_acreditada`, `cantidad_disponible` y `monto_disponible` total. Usado por el wizard para validar.

## Edge function `afip-facturacion`

Ya soporta `cbtes_asoc`. Agregar acción nueva `emitir_nc_parcial` que reciba:
- `factura_origen_id` (comprobante AFIP origen)
- `tipo_nc` (`parcial_items` | `parcial_bonificacion`)
- `motivo` + `observaciones`
- `items[]` (cuando es por ítems): `venta_detalle_id`, `cantidad`, `precio_unitario`, `iva_id`
- `importe_bonificacion` (cuando es por bonificación)
- `reingresar_stock` (bool)

Flujo del backend:
1. Carga factura origen, valida estado autorizado y no anulada.
2. Re-valida con RPC que cantidades/importe no superan lo disponible (anti race).
3. Determina tipo NC: factura A→3, B→8, C→13.
4. Construye items para AFIP y llama `autorizarComprobante` con `cbtes_asoc = [{ tipo, pv, nro, fecha }]`.
5. Inserta en `comprobantes_afip` con `factura_origen_id`, `motivo_nc`, `tipo_nc`, `observaciones`.
6. Inserta filas en `nota_credito_items`.
7. Si `reingresar_stock`: por cada item suma stock y crea `movimientos_inventario` (entrada).
8. Crea movimiento `NCR` en `cliente_movimientos` por el total.
9. Actualiza `ventas.monto_acreditado` y `acreditada_parcial = true`. Si saldo = 0 → marca también `anulada=true` con motivo "NC total acumulada".

## UI — `src/pages/Facturacion.tsx`

Por cada fila de comprobante:
- Ojito (ya existe).
- **Nuevo botón "Generar NC"** con icono `FileMinus`, visible solo si: tipo factura (1/6/11), `estado='autorizado'`, venta no anulada, y `saldo_disponible > 0`.
- Badge "NC parcial" / "NC total" cuando aplique.

En el modal de detalle del comprobante (ya existente), agregar sección **"Comprobantes asociados"**: lista de NCs emitidas contra esta factura (número, fecha, monto, motivo) con botón "Ver" y "Reimprimir ticket" para cada una.

## UI — Wizard `NotaCreditoParcialWizard.tsx` (componente nuevo)

Dialog con stepper de 4 pasos:

**Paso 1 — Información factura origen** (solo lectura):
Número, fecha, cliente, total, productos facturados con cantidades disponibles.

**Paso 2 — Motivo**:
RadioGroup obligatorio: Devolución de mercadería / Bonificación comercial / Error de facturación / Otro. Si "Otro" → textarea obligatorio. Determina automáticamente el tipo:
- Devolución de mercadería → modo **ítems**.
- Bonificación comercial → modo **bonificación**.
- Error de facturación / Otro → permite elegir modo ítems o monto.

**Paso 3 — Detalle**:
- *Modo ítems*: tabla con productos de la factura (cantidad facturada, ya acreditada, disponible, **cantidad a devolver** editable, precio, descuento, importe a acreditar calculado). Total NC dinámico abajo. Toggle "¿La mercadería vuelve al stock? Sí/No".
- *Modo bonificación*: radio Importe fijo / Porcentaje + input. Si porcentaje, calcular sobre el total disponible de la factura. Validar que no exceda saldo disponible.

**Paso 4 — Resumen y confirmación**:
Factura origen, productos/bonificación, motivo, observaciones, subtotal neto, IVA, total NC. Botón "Emitir Nota de Crédito" que llama la edge function. Mientras procesa, muestra loader.

Al terminar: toast de éxito + impresión automática del ticket NC reutilizando `imprimirTicketFactura` (ya soporta NC con comprobante asociado) + invalidación de queries de facturación.

## Validaciones (cliente y servidor)

- No permitir cantidad > disponible por línea.
- No permitir total NC > saldo disponible de la factura.
- Considerar NCs previas (vía RPC) para los saldos.
- Sólo facturas autorizadas y no anuladas.
- Permiso `facturacion.crear` requerido.

## Reimpresión y visualización

Las NC quedan automáticamente en el listado de `Facturacion.tsx` (son comprobantes AFIP). El ojito ya muestra el detalle. Para NCs se mostrará además el bloque "Comprobante asociado" (ya soportado por `imprimirTicketFactura`).

## Fuera de alcance (según pedido)

- No se implementa flujo de cambio de productos: se documenta operativamente (emitir NC + nueva venta).
- No se modifica la pantalla de Ventas: la acción vive sólo en Facturación Electrónica.
- La anulación total automática existente se conserva sin cambios.
