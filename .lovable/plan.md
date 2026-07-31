# Subir PDFs en /subir-fotos

Hoy la pantalla de subida de comprobantes sólo acepta imágenes. Se agrega soporte para PDF.

## Cambios

1. **Selección de archivo**
   - El selector acepta `image/*` y `application/pdf`.
   - Botón con texto adaptado: "Subir comprobante" (foto o PDF). En el APK se mantiene el atajo de cámara nativa, con opción de elegir archivo/PDF si el usuario no toma foto.
   - Validación de tamaño (máx. ~10 MB) y de tipo antes de subir.

2. **Subida y adjunto**
   - Misma ruta de storage y misma RPC `adjuntar_comprobante_transferencia`; se conserva la extensión real (`.pdf`) y el `contentType` correcto.

3. **Previsualización**
   - Si el archivo es PDF, en lugar de `<img>` se muestra el PDF embebido (visor del navegador) más un enlace "Abrir en pestaña nueva" con la URL firmada, para móviles que no embeben PDFs.
   - Las imágenes siguen mostrándose igual.

4. **Lectura automática con IA (OCR)**
   - Se intenta el análisis también para PDFs enviando el archivo al mismo endpoint de IA.
   - Si el modelo no puede leer el PDF, no se rompe nada: la transferencia queda adjuntada y los datos se completan manualmente (mismo comportamiento actual cuando el OCR falla). El estado "Analizando IA" desaparece al finalizar.

## Detalles técnicos

- `src/pages/SubirFotos.tsx`: `accept` del input, detección de tipo por `file.type`/extensión, extensión dinámica en el path, render condicional de la preview (`<iframe>`/`<object>` + link firmado), y el flujo de OCR aceptando `application/pdf`.
- `src/lib/nativeCamera.ts`: sin cambios funcionales obligatorios; el fallback web ya cubre PDF.
- Sin cambios de base de datos ni de RLS: el bucket `comprobantes-cobros` ya acepta cualquier archivo y la RPC solo guarda path y nombre.

## Filtro rápido de rango temporal

- Se agrega un selector de rango arriba del listado: **Última hora** (por defecto para reducir ruido), Hoy, 7 días, 60 días.
- El filtro se aplica sobre `created_at` de la transferencia en la consulta (no sólo en cliente), manteniendo el tope de 60 días como máximo.
- Los contadores de las pestañas (Sin comprobante / Con comprobante / Validar) reflejan el rango elegido.
