## Cambio

En `src/components/cajas/ConfirmarArqueoDialog.tsx`, reemplazar el bloque condicional actual de observaciones por una Card siempre visible:

- Título destacado: **"Observaciones del cajero"** (con ícono `MessageSquare` o similar).
- Cuerpo:
  - Si `caja.observaciones` tiene texto → mostrarlo en `whitespace-pre-wrap`.
  - Si está vacío → texto en muted: *"Sin observaciones registradas"*.
- Ubicada arriba del bloque de botones, después de la Card de "Resultado".

Sin cambios en backend ni en `EditarArqueoDialog` (las observaciones ya se persisten al enviar a revisión en el campo `cajas.observaciones`).
