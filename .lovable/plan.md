
# Vista móvil de subida de comprobantes — v1

Ruta nueva `/subir-fotos`, mobile-first, para que la cajera adjunte foto de comprobante a las transferencias que ella misma registró. Sin OCR, sin selector de caja, sin reemplazo.

## Categorización

**Solo frontend** (nueva ruta + nuevo componente). No toca DB, RLS, edge functions, POS, Imputación, ni la RPC `adjuntar_comprobante_transferencia` (ya aplicada). Off-hours: sin riesgo, canal aditivo.

## Alcance

- Nueva ruta protegida `/subir-fotos` en `src/App.tsx` con `ProtectedRoute redirectPath="/subir-fotos"`.
- Nuevo archivo `src/pages/SubirFotos.tsx`, mobile-first, mismo esqueleto que `src/pages/Encargado.tsx` (header sticky con logout + refetch, `max-w-md mx-auto`, `Card` por fila, `Sheet` shadcn para preview).
- Dos pestañas (`Tabs` shadcn): "Sin comprobante" y "Con comprobante".

## Datos — patrón "transferencias primero" (evita `.in()` grande)

Invertimos el orden respecto al plan inicial: **traemos primero las transferencias recientes y después filtramos por ownership**. Así el `.in()` opera sobre decenas de IDs, no miles, y se respeta el invariante de URL length del proyecto.

1. Ventana temporal: transferencias de los últimos **60 días** (`created_at >= now() - interval '60 days'`), sin filtrar por estado (una `validada` puede seguir sin foto). Cubre de sobra el flujo real; foto de un cobro de hace 2 meses es un caso admin, no de cajera.
2. `transferencias.select('*').gte('created_at', hace60d).order('created_at', { ascending: false })` — sin filtro por `venta_id` todavía. RLS le entrega solo las que puede ver (todas, para vendedor).
3. `ventaIds = unique(transferencias.map(t => t.venta_id).filter(Boolean))` — decenas, no miles.
4. `ventas.select('id, numero_comprobante, fecha, cliente_id, usuario_id').in('id', ventaIds)` → `ventasMap`.
5. Filtro de ownership en cliente: `transferencias.filter(t => ventasMap.get(t.venta_id)?.usuario_id === user.id)`.
6. Nombres de cliente (opcional): `clientes.select('id, nombre').in('id', clienteIds)` sobre los `cliente_id` de las ventas filtradas — otra vez decenas.

Cortocircuitos:
- Si `transfData` viene vacío → no llamar pasos 4/6.
- Si `ventaIds` queda vacío → tampoco.

Split de pestañas en cliente sobre el resultado filtrado:
- Sin comprobante: `foto_comprobante_path == null`.
- Con comprobante: `foto_comprobante_path != null`.

### Detalle de tipos (evitar timeouts de tsgo)

`.select("...")` con strings largos multiplica el parseo de tipos. Uso el helper `const sel = (s: string): string => s` y `.returns<T[]>()` con interfaces locales por query, como está documentado en el proyecto.

## Card por fila (v1)

- `#{numero_comprobante}` de la venta asociada.
- Fecha (`date-fns` + `es`).
- Importe (`Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`).
- `titular_nombre` de la transferencia.
- Nombre de cliente si está.
- Badge de estado (`pendiente` / `validada` / `rechazada`).

## Upload (pestaña "Sin comprobante")

Botón "Subir foto" por fila:

1. `tomarFotoNativa()` (`src/lib/nativeCamera.ts`); si retorna `null` (móvil web), abrir `<input type="file" accept="image/*" capture="environment">` oculto.
2. Path: `transferencias/{transferencia_id}/{Date.now()}-{crypto.randomUUID()}.{ext}`.
3. `supabase.storage.from('comprobantes-cobros').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })`.
4. Si upload OK → `supabase.rpc('adjuntar_comprobante_transferencia', { p_transferencia_id, p_path: path, p_nombre: file.name })`.
5. Si RPC OK → `toast.success` + refetch.

### Orden `upload → RPC` (confirmado)

Es el orden correcto:
- Bucket privado → archivo huérfano no expone datos.
- La RPC valida ownership + "sin comprobante todavía" con `FOR UPDATE` y solo entonces persiste el `path`. Si escribiéramos primero y subiéramos después, un fallo de red dejaría la fila apuntando a un archivo inexistente, y la RPC ya no permite reintentar (rechaza porque "ya tiene comprobante").
- Peor caso con `upload → RPC`: archivo huérfano en Storage, tabla intacta.

### Manejo "upload OK pero RPC falla"

Errores esperables de la RPC:
- `"Esta transferencia ya tiene comprobante cargado"` (otro dispositivo la adjuntó primero).
- `"No podés adjuntar comprobante a una transferencia que no registraste"` (edge case con datos viejos).
- Fallo de red al invocar la RPC.

Acción: `toast.error("Archivo subido pero NO quedó adjuntado: <mensaje RPC>. Avisá al administrador.")`. La fila **no se mueve** a "Con comprobante" y no se marca cargada. No se borra el archivo huérfano en v1 (admin limpia después).

Estados visuales:
- Durante upload+RPC: botón deshabilitado + spinner ("Subiendo...").
- Éxito: toast success + refetch.
- Fallo upload: `toast.error("No se pudo subir el archivo")`.
- Fallo RPC post-upload: toast con el mensaje mixto de arriba.

## Pestaña "Con comprobante"

- Mismos campos + badge "Adjuntado".
- Tap sobre la card abre `Sheet` con preview de la imagen usando `createSignedUrl(path, 60 * 10)` on-demand (patrón `Imputacion.tsx:867-872`).
- Solo lectura. Sin reemplazo.

## Header

Como `Encargado.tsx`: sticky top, `max-w-md`, título "Subir comprobantes", subtítulo `profile.nombre`, botón refetch (`RefreshCw`) + logout (`LogOut`).

## Diagrama

```text
GET /subir-fotos
      │
      ▼
transferencias WHERE created_at >= now() - 60d
      │
      ▼
ventaIds = unique(transf.venta_id)  ← decenas
      │
      ▼
ventas WHERE id IN (ventaIds)       ← .in() chico
      │
      ▼
filter transferencias por ventasMap[venta_id].usuario_id == auth.uid()
      │
      ├── foto_path == null ─► Tab "Sin comprobante" ─► [Subir foto]
      │                                                        │
      │                                                        ▼
      │                                          tomarFotoNativa() ó <input capture>
      │                                                        │
      │                                                        ▼
      │                                          storage.upload(path, file)
      │                                                ┌──────┴──────┐
      │                                                ▼             ▼
      │                                              ok            fail → toast
      │                                                │
      │                                                ▼
      │                                        rpc adjuntar_...
      │                                                ┌──────┴──────┐
      │                                                ▼             ▼
      │                                              ok            fail
      │                                                │             │
      │                                                ▼             ▼
      │                                       toast + refetch    toast "subido pero no adjuntado"
      │
      └── foto_path != null ─► Tab "Con comprobante" ─► tap ─► signedUrl 10min ─► preview
```

## Restricciones

- No tocar POS, `pos_registrar_venta`, Imputación, ni la RPC.
- No disparar OCR.
- Sin selector de caja.
- Colores por tokens (nada de `text-white` / `bg-[#...]`).
- Filtro `usuario_id` en cliente (RLS ya muestra todas a vendedor).
- Select strings vía helper `sel()` + `.returns<T>()` para no hacer explotar el typecheck.

## Archivos que se tocan

- `src/App.tsx` — agregar `<Route path="/subir-fotos" ... />` con import.
- `src/pages/SubirFotos.tsx` — nuevo.

Nada más.
