## Objetivo
Agregar en la tabla de Ventas (`/ventas`) una nueva columna **"Nº Factura"** que muestre el número de factura emitida en ARCA (AFIP) para la venta correspondiente.

## Ubicación
Archivo: `src/pages/Ventas.tsx`, definición del array `columns` (línea 636).

## Cambios

1. Insertar una nueva columna `numero_factura` ubicada inmediatamente después de la columna `Nº Venta`, para que queden contiguas.
2. El render leerá `item.comprobantes_afip?.[0]` y mostrará el número con formato estándar AFIP:
   `PPPP-NNNNNNNN` (punto de venta de 4 dígitos + número de comprobante de 8 dígitos, separados por guion), por ejemplo `0001-00001234`.
3. Opcionalmente se antepone la letra del comprobante usando `TIPOS_COMPROBANTE[tipo_comprobante]` (A/B/C/M), quedando: `B 0001-00001234`.
4. Si la venta no tiene comprobante AFIP (sin facturar, pedido web/reparto, o falló AFIP), se mostrará un guion `—` en color atenuado.
5. Usar `font-mono` para alinear visualmente con `Nº Venta`.

## Notas
- No se modifica la query ni el backend: los datos de `comprobantes_afip` ya vienen incluidos en la respuesta de `get_ventas_lista` y están tipados en la interfaz `ComprobanteAfip` (campos `punto_venta`, `numero_comprobante`, `tipo_comprobante`).
- No se altera el formato del ticket factura ni la lógica de reimpresión.
- Es un cambio puramente de presentación en el frontend.
