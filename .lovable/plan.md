## 1. Arqueo de caja — sumar Débito + Crédito + Transferencia (QR)

Los POSTNET liquidan un único total combinando débito, crédito y QR. Hoy el arqueo compara cada categoría por separado y aparecen falsos desvíos.

**Cambios**
- `src/components/cajas/EditarArqueoDialog.tsx` y `ConfirmarArqueoDialog.tsx`: fusionar las filas `debito`, `credito` y `transferencia` en una única fila **"Tarjetas + QR (POSTNET)"** que muestre:
  - Sistema = suma de los tres subtotales (con detalle desplegable por medio).
  - Declarado = un solo input editable.
  - Diferencia calculada sobre el total combinado.
- `Cajas.tsx` / `CajaDetalle.tsx` (KPIs de arqueo): agrupar igual al mostrar el resumen.
- Persistencia: guardar el declarado del bloque prorrateado por categoría (o en un único registro categoría `tarjetas_qr`). Elegimos prorrateo proporcional al sistema para no romper el histórico ni la tabla `arqueo_detalles`.
- Efectivo, Cheque y Otro quedan iguales.

## 2. Subir Fotos — OCR automático + validación por lote

**Flujo nuevo en `/subir-fotos`**
- Al seleccionar/tomar la foto, subir a storage y disparar automáticamente `extraer-numero-operacion` (ya devuelve nº operación, monto, fecha, CUIL, titular, banco + confianzas).
- Guardar los campos extraídos en la fila `transferencias` (numero_operacion, fecha_transferencia, cuil_titular, titular_nombre, banco) sin intervención del usuario.
- Mostrar en la tarjeta el estado: **Coincide** / **No coincide** / **Sin match**, comparando contra la venta asociada (monto y, si hay, CUIL cliente).

**Nueva pantalla `/imputacion` (o pestaña dentro de Subir Fotos para admins)**
- Dos listas: **Coinciden** y **No coinciden / revisar**.
- Checkbox por fila + **"Seleccionar todas las coincidentes"**.
- Botón **"Validar seleccionadas"** que llama en lote a la lógica actual de validación (marcar `estado='validada'`).
- Las que no coinciden se validan solo una a una desde el detalle actual.

**Backend**
- RPC `validar_transferencias_lote(ids uuid[])` con `SECURITY DEFINER` que aplica las mismas reglas que la validación individual (roles admin/encargado/administracion) y devuelve conteo ok/error.
- Índice/constraint ya existente sobre `numero_operacion` evita duplicados.

## 3. Renombrar "Imputación de Pagos" → "Imputación de Cobros"

Reemplazar el título/labels en:
- `src/pages/Imputacion.tsx` (encabezado, breadcrumb, toasts).
- `src/components/layout/AppSidebar.tsx` (item de menú).
- Cualquier botón "Ver en Imputación de pagos" (Cajas, Ventas detalle).
- Título de página / `document.title` si aplica.

La ruta `/imputacion` no cambia para no romper links guardados.

## Detalles técnicos

- **Arqueo agrupado**: en `get_arqueo_por_medio` no hace falta cambiar la RPC; agrupamos en el front. Al confirmar, dividimos el declarado total en 3 filas proporcionales al sistema (si sistema=0, se asigna todo a la categoría con más operaciones) para respetar el esquema actual de `arqueo_detalles`.
- **OCR auto**: llamar la edge function desde el cliente después del `upload` exitoso, con timeout y fallback silencioso — si falla, la foto queda igual y se puede reintentar.
- **Validación por lote**: la RPC debe ser transaccional y saltear (no abortar) filas ya validadas.
- **Realtime opcional** en `/subir-fotos` para reflejar cambios de estado tras la validación.

## Fuera de alcance
- No se toca el flujo del POS ni la creación de transferencias.
- No se cambian permisos existentes ni el layout general.
- No se migran datos históricos de arqueos ya cerrados.
