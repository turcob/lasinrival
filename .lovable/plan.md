## Problema

Hoy, cuando el encargado marca una parada como **"Rechazado"** desde `ParadaSheet` (botón rojo + motivo), solo se actualiza el estado de la parada a `no_entregado` y se guarda la observación. **No se registran devoluciones por cada producto del pedido**, así que:

- Los productos **no aparecen en "Stock Rechazado"** disponibles para revender en otra parada.
- **No se generan Notas de Crédito pendientes** para que administración apruebe el reingreso al stock central.

En cambio, el flujo de "Entrega parcial → rechazo total" sí registra devoluciones (vía `DevolucionSheet`) y por eso funciona como el usuario espera.

## Objetivo

Que el botón "Rechazado" (rechazo total) tenga el mismo comportamiento que un rechazo ítem por ítem, pero aplicado a **todos los productos del pedido automáticamente**.

## Cambios

### `src/components/encargado/ParadaSheet.tsx`

Reemplazar `handleRechazado` para que, además de cambiar el estado a `no_entregado`:

1. Recorra `parada.pedido.detalles` y, por cada renglón con cantidad > 0, llame al hook existente `useRegistrarDevolucion` (mutación `registrarDevolucion`) con:
   - `hoja_ruta_id`, `parada_id`, `pedido_detalle_id`
   - `cantidad = cantidad_pedida` del renglón
   - `motivo = 'rechazo_cliente'`
   - `detalle_motivo = obs` (la observación que ya escribe el encargado)
   - `reingresarStock = true` (default; lo aprueba administración al confirmar la NC)
2. Recién después llamar a `cambiarEstado` con `estado: 'no_entregado'` y la observación.
3. Manejar errores: si falla algún ítem mostrar toast y no cerrar el sheet.

Esto reutiliza exactamente el mismo camino que ya usa el rechazo parcial → genera entradas en `hoja_ruta_devoluciones` (las habilita en la pestaña "Stock Rechazado") y crea `notas_credito_pendientes` por cada producto.

### Texto del botón

Mantener "Rechazado" como hoy (no se toca terminología). El estado en BD sigue siendo `no_entregado` para no romper datos históricos.

## Lo que NO cambia

- Esquema de base de datos: ningún cambio.
- Lógica del módulo Logística web: las NC pendientes siguen siendo aprobadas desde administración como hoy.
- Flujo de "Entrega parcial": queda igual.
- El badge de estado en `ParadasTab` sigue mostrando "No entregado" (o lo que esté hoy).

## Riesgos

- Si el pedido tiene muchos ítems, la operación hace N inserts secuenciales. Es aceptable porque las paradas suelen tener pocos renglones; igualmente se puede ejecutar con `Promise.all` para acelerar.
- Si se vuelve a presionar "Rechazado" sobre una parada ya rechazada se duplicarían las devoluciones. Mitigación: `handleRechazado` ya no se puede invocar si `yaEntregado` (el botón no se muestra en ese caso).
