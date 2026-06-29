## Objetivo
Incorporar facturación AFIP al flujo de venta en cuenta corriente del POS, equiparándolo al flujo de pago directo.

## Situación actual
- `handleProcesarVentaCC` (src/pages/POS.tsx ~L1280) registra la venta + movimiento en CC y muestra el ticket, pero nunca abre el diálogo de facturación ni invoca `afip-facturacion`.
- `handleProcesarVenta` (pago directo) sí ejecuta `handleOpenFacturaDialog()` → diálogo con tildado de "Emitir factura" + selección de tipo/condición IVA → invoca `supabase.functions.invoke('afip-facturacion/emitir')` → guarda en `comprobantes_afip` → incluye datos AFIP en el ticket impreso.

## Cambios

### src/pages/POS.tsx
1. **Botón "Confirmar venta CC"**: en lugar de llamar directo a `handleProcesarVentaCC`, llamar a `handleOpenFacturaDialog()` (igual que pago directo). Marcar un flag `modoVentaCC = true` para que el confirm del diálogo dispare la rama correcta.
2. **Diálogo de facturación**: precargar `tipo_comprobante`, `doc_tipo`, `doc_nro` y `condicion_iva_receptor` desde `selectedCliente` (ya existe esa lógica en `handleOpenFacturaDialog` para clientes con CUIT). "Emitir factura" tildado por defecto.
3. **Confirm del diálogo**: cuando `modoVentaCC === true`, ejecutar la lógica actual de `handleProcesarVentaCC` (RPC `pos_registrar_venta` con `p_cliente_movimiento`, sin pagos ni movimiento de caja) y, si `emitirFactura` está tildado, ejecutar el mismo bloque AFIP que ya existe en `handleProcesarVenta`:
   - `supabase.functions.invoke('afip-facturacion/emitir', ...)` con `venta_id` de la venta recién creada.
   - Insertar registro en `comprobantes_afip` con `usuario_id`, `venta_id`, CAE, importes, etc.
   - Adjuntar `facturaInfo` a `lastVenta` para que el ticket impreso muestre los datos AFIP (ya soportado en el bloque de impresión de factura ~L1969).
4. **Manejo de errores AFIP**: si falla la emisión, la venta y el movimiento de CC quedan confirmados (igual que hoy en pago directo), solo se muestra `toast.error` con el mensaje AFIP. Esto preserva la consistencia: la deuda en CC ya está registrada y la factura puede reemitirse luego desde Facturación.
5. **Reset post-venta**: limpiar `clienteModalidadPago`, `facturaDialogOpen`, `emitirFactura` y `modoVentaCC` junto con el resto del estado.

## Detalles técnicos
- No requiere cambios en la edge function `afip-facturacion` ni en la RPC `pos_registrar_venta`.
- La tabla `comprobantes_afip` ya acepta el `venta_id` correspondiente; el flujo de NC posterior (que lee `cliente_movimientos` y la factura para definir resolución financiera) seguirá funcionando porque la NC sobre una factura cuyo origen fue CC automáticamente cae en la rama "crédito en CC" según la regla ya implementada.
- El ticket térmico ya tiene rama para imprimir formato Factura (con CAE/QR) cuando `lastVenta.factura` existe; al haber CC sin pagos, se imprimirá la factura con leyenda "Cuenta Corriente" (agregar línea informativa "Forma de pago: Cuenta Corriente" en el bloque de factura).

## Validación
- Venta CC con cliente Cons. Final → Factura B emitida, CAE recibido, deuda en CC creada, ticket impreso con datos AFIP.
- Venta CC con cliente Resp. Inscripto (CUIT) → Factura A precargada, CAE recibido.
- Venta CC con "Emitir factura" destildado → comportamiento actual (solo deuda en CC, sin AFIP).
- Falla AFIP → venta queda confirmada en CC, toast de error, usuario puede reintentar emisión desde Facturación.