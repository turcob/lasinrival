# /subir-fotos: ver, eliminar y reemplazar el comprobante

Hoy, una vez adjuntado un comprobante, no hay forma de quitarlo ni de subir otro: la vista previa es solo lectura y la función de adjuntar rechaza cualquier transferencia que ya tenga archivo. Se agrega el ciclo completo ver / eliminar / volver a subir.

## Cambios visibles

1. **Vista previa (hoja inferior)**
   - Se mantiene la imagen o el PDF embebido, y se agregan dos acciones al pie:
     - **Eliminar comprobante** (con confirmación "¿Eliminar el comprobante adjunto?").
     - **Reemplazar comprobante** (abre cámara nativa en el APK o el selector de archivo/PDF en web; elimina el anterior y sube el nuevo).
   - Botón para abrir la imagen en pestaña nueva (hoy sólo existe para PDF).

2. **Tarjetas de la pestaña "Con comprobante"**
   - Además de abrir la vista previa al tocar, cada tarjeta muestra acciones rápidas **Ver** / **Reemplazar** / **Eliminar**.

3. **Reglas**
   - Al eliminar, la transferencia vuelve a la pestaña "Sin comprobante" y desaparece de "Validar".
   - Las transferencias ya **validadas** no permiten eliminar ni reemplazar (solo admin/encargado/administración pueden hacerlo, y se avisa que la validación queda sin respaldo).
   - Tras reemplazar se vuelve a ejecutar el OCR automático para autocompletar número de operación, fecha, titular y banco.

## Detalles técnicos

- Nueva función `public.quitar_comprobante_transferencia(p_transferencia_id uuid)` (SECURITY DEFINER, grant a `authenticated`) que:
  - valida autenticación y los mismos permisos que `adjuntar_comprobante_transferencia` (admin, o dueño de la venta asociada),
  - bloquea el borrado si `estado = 'validada'` salvo para roles admin/encargado/administracion,
  - limpia `foto_comprobante_path` y `foto_comprobante_nombre` y devuelve el path anterior para poder borrar el objeto en storage.
- `src/pages/SubirFotos.tsx`:
  - `eliminarComprobante(fila)`: llama la RPC, luego `storage.remove([path])` del bucket `comprobantes-cobros`, cierra la hoja y refresca.
  - `handleReemplazarClick(fila)`: reutiliza `pendingFilaRef` + `tomarFotoNativa`/input file, marca la fila como "reemplazo" y ejecuta eliminar → subir → OCR.
  - `FilaCard` recibe `onEliminar` / `onReemplazar` y muestra los botones cuando `conFoto`.
- Las políticas de storage ya permiten borrar objetos del bucket a usuarios autenticados; no se tocan.
- Nota aparte: el bucket tiene `allowed_mime_types` limitado a imágenes, por lo que los PDF pueden ser rechazados al subir. Se agrega `application/pdf` a los tipos permitidos del bucket para que el flujo PDF ya planificado funcione.
