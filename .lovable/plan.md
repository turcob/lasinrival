
## Alcance
Cambios acotados en 2 archivos frontend: `src/pages/POS.tsx` y `src/pages/Imputacion.tsx`. No se toca la edge function (ya extendida en el turno anterior), ni el flujo FIFO, ni el trigger `transferencias_validar_transicion`, ni migraciones. Una transferencia sigue sin impactar cuenta corriente mientras esté `pendiente`.

## 1) POS.tsx — validación relajada de `handleConfirmarTransferencia` (~L867-874)

Regla nueva:
- `fecha` y `importe` → siempre obligatorios.
- Si **NO** hay archivo adjunto (`transferenciaData.archivo`) → seguir exigiendo `cuil` (11 dígitos válidos) y `numero_operacion` como hoy.
- Si **hay** archivo adjunto → permitir guardar con `cuil`, `titular` y `numero_operacion` vacíos. En ese caso:
  - Si el usuario cargó CUIL pero es inválido (largo distinto de 11 y no vacío), seguir bloqueando: no aceptamos basura, sólo vacío.
  - Se pasa `numero_operacion` como `null` a la RPC cuando está vacío (hoy se hace `.trim()` — se ajusta para permitir `null`). El `unique index` actual sobre `(cliente_id, numero_operacion)` no se dispara cuando el valor es NULL en Postgres.

Diálogo (líneas 3156-3206):
- Cambiar los labels de "CUIL/CUIT *", "Número de comprobante *" a sin asterisco cuando hay archivo. Simplificación: mantenerlos con `*` pero agregar un **Alert** amarillo dentro del diálogo:
  > "Podés adjuntar el comprobante y dejar los campos vacíos. Quedarán pendientes de completar desde Imputación con ayuda de IA."
  Este alert se muestra siempre; el usuario elige.
- En `POS.tsx` L1556, ya se pasa `numero_operacion: transferenciaData.numero_operacion.trim()` — cambiar a `numero_operacion.trim() || null` para no guardar string vacío.
- Idem `titular_cuil` y `titular_nombre` → normalizar a `null` cuando vacíos.

## 2) Imputacion.tsx — botón "Autocompletar con IA" + edición previa a validar

Estado nuevo dentro del modal de detalle:
```ts
type FieldSource = 'manual' | 'ai' | null;
type FieldMeta = { source: FieldSource; confianza?: 'alta' | 'media' | 'baja' };

const [editableCampos, setEditableCampos] = useState<{
  numero_operacion: string;
  titular_nombre: string;
  titular_cuil: string;
  fecha_transferencia: string;
  banco: string; // solo display, hoy no hay columna
} | null>(null);

const [camposMeta, setCamposMeta] = useState<Record<string, FieldMeta>>({});
const [autocompletandoIA, setAutocompletandoIA] = useState(false);
```

Cuando se abre el detalle de una transferencia **pendiente** con al menos un campo faltante (`!numero_operacion || !titular_cuil || !titular_nombre`), en lugar de mostrar los campos como texto readonly, se muestran como `<Input>` editables inicializados con el valor actual (o vacío). Si están todos completos, se sigue mostrando el modo actual readonly (para no romper la UX cuando ya está todo cargado).

Botón "Autocompletar con IA":
- Ubicación: en la sección de comprobante, junto al botón "Cambiar comprobante".
- `disabled` cuando: `!detalleTransfMov.foto_comprobante_path` || no está pendiente || `autocompletandoIA`.
- Al clickear:
  1. Descargar el archivo del bucket `comprobantes-cobros` con `supabase.storage.from('comprobantes-cobros').download(path)`.
  2. Rechazar PDFs por ahora → toast "Solo imágenes JPG/PNG por IA. PDFs se completan manualmente." (la edge sólo acepta imágenes vía `image_url`).
  3. Convertir Blob a base64 (`FileReader.readAsDataURL`, sacar prefix).
  4. `supabase.functions.invoke('extraer-numero-operacion', { body: { imageBase64, mimeType } })`.
  5. Rellenar sólo los campos que hoy están vacíos en `editableCampos` (no pisar lo que el usuario ya editó). Si el resultado del campo es `null`, dejarlo vacío. Nunca inventar.
  6. Guardar en `camposMeta[campo] = { source: 'ai', confianza: r.confianza_campos[campo] || r.confianza }`.
- Los `Input` de campos con `camposMeta[x].source === 'ai'` se distinguen visualmente con un borde azul (`border-blue-400`) y un pequeño badge con ícono ✨ + texto "IA · alta/media/baja" al lado del label. Cuando el usuario edita manualmente ese input (`onChange`), su `source` pasa a `'manual'` y el estilo vuelve a la normalidad.
- Nada se guarda automáticamente. Junto a "Cerrar", cuando hay `editableCampos` modificados, aparece botón "Guardar cambios" que hace `UPDATE transferencias SET numero_operacion, titular_nombre, titular_cuil, fecha_transferencia WHERE id = transferencia_id` y refresca.

Ícono/estilos: usar `Sparkles` de `lucide-react` para el botón IA; badge con `bg-blue-100 text-blue-700 border-blue-300`. Sin colores hardcodeados fuera del componente — se usan clases Tailwind ya presentes en el proyecto.

Toasts:
- `"Comprobante analizado con IA. Revisá los datos antes de validar."`
- Errores 429/402 mapeados a mensajes en español ya usados en el proyecto.

## 3) Revalidación de duplicado en `handleConfirmar` (L411-431)

Antes del `UPDATE ... SET estado = 'validada'` sobre transferencias:

```ts
// Obtener numero_operacion actual (por si fue editado sin guardar aún, exigir guardar primero)
const numOp = selectedMovimiento.numero_operacion?.trim();
if (!numOp) {
  toast.error('La transferencia no tiene número de operación. Completalo antes de validar.');
  return;
}
const { data: dup } = await supabase
  .from('transferencias')
  .select('id, cliente_id')
  .eq('numero_operacion', numOp)
  .eq('estado', 'validada')
  .neq('id', selectedMovimiento.transferencia_id)
  .limit(1);

if (dup && dup.length > 0) {
  const mismoCliente = dup[0].cliente_id === selectedMovimiento.cliente_id;
  const msg = mismoCliente
    ? 'Ya existe otra transferencia validada del mismo cliente con este número de operación. ¿Confirmar de todos modos?'
    : 'Ya existe una transferencia validada de OTRO cliente con este mismo número de operación. ¿Confirmar de todos modos?';
  if (!window.confirm(msg)) { setProcessing(false); return; }
}
```

- El unique index actual protege el clash `(cliente_id, numero_operacion)`. Esta revalidación añade cobertura cross-cliente (soft warning con `window.confirm`, no bloqueo duro).
- Además exige que el número de operación esté cargado al momento de validar (regla natural: podés guardar la transferencia vacía, pero no validarla sin número).

## 4) Post-condiciones / lo que NO se toca

- Trigger `transferencias_validar_transicion` → no se modifica.
- Índice único → no se modifica (la revalidación cross-cliente es sólo warning, no constraint).
- Imputación FIFO / creación de `cliente_movimientos` al validar → sin cambios.
- Edge function `extraer-numero-operacion` → ya extendida en el turno anterior (fecha, cuil_titular, titular, banco + confianza por campo).
- La columna `banco` no existe hoy en `transferencias`. El campo devuelto por IA se muestra en pantalla como referencia informativa pero **no** se persiste. Si más adelante querés persistirlo, hace falta migración (fuera de alcance).

## Riesgos
- Guardar transferencias con `numero_operacion = null` habilita casos donde el unique index no protege duplicados. Se compensa con la revalidación en validar (paso 3) y con el hecho de que sólo puede validarse una transferencia que ya tiene número cargado.
- OCR por IA sobre PDFs no está soportado en esta iteración (edge sólo acepta `image_url`); se avisa al usuario.
