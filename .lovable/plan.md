# Diferir la carga del comprobante de transferencia al celular

## Contexto

Hoy en POS, al elegir pago con **Transferencia**, el diálogo `handleConfirmarTransferencia` obliga a una de dos cosas:

- Adjuntar la foto del comprobante en el momento, **o**
- Cargar CUIL/CUIT válido (11 dígitos) + número de operación.

La cajera muchas veces no tiene la foto ni el CUIL en el momento (el cliente todavía no le mostró el comprobante), pero necesita cerrar la venta. Ya existe la ruta mobile **`/subir-fotos`** que permite adjuntar la foto a una transferencia propia después, vía la RPC `adjuntar_comprobante_transferencia`. Falta permitir que la venta se cierre "en descubierto" y quede lista para completar desde ahí.

## Cambios

### Frontend — `src/pages/POS.tsx`

1. **Relajar la validación en `handleConfirmarTransferencia`** (líneas ~896-942):
   - Obligatorios: **fecha** e **importe** > 0.
   - Opcionales: archivo, CUIL, número de operación, titular.
   - Si el CUIL viene cargado parcial (>0 y ≠11 dígitos), seguir rechazando (evitar basura). Igual para número de operación: si viene lo respetamos, si no queda `null`.
   - Quitar el bloqueo "Sin comprobante adjunto: obligamos los campos como siempre".

2. **UI del diálogo de transferencia**:
   - Marcar CUIL y N° operación como "opcional" en el label.
   - Agregar una nota informativa al pie:
     > "Podés dejar la foto y los datos para después. La cajera puede completarlo desde el celular en **/subir-fotos** una vez que reciba el comprobante."
   - Mantener el botón "Extraer con IA" cuando sí hay foto.

3. **Al persistir la venta** (líneas ~1570-1602): el payload `p_transferencia` ya acepta `foto_comprobante_path: null` y campos opcionales — no requiere cambios de RPC. Sólo asegurar que el toast post-venta avise "Recordá subir la foto desde /subir-fotos" cuando la transferencia se guardó sin archivo.

### Sin cambios de DB

La transferencia ya se puede crear con `foto_comprobante_path = null`, `titular_cuil = null`, `numero_operacion = null`. La RPC `adjuntar_comprobante_transferencia` ya cubre el adjunto posterior con ownership.

## Fuera de alcance

- No se toca `/subir-fotos` — ya lista todas las transferencias de los últimos 60 días del usuario sin foto.
- No se agrega notificación push ni recordatorio automático (se puede evaluar aparte).
- No se cambian políticas RLS de `transferencias`.
