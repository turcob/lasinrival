
## Alcance
Modificar únicamente `supabase/functions/extraer-numero-operacion/index.ts`. No se toca el frontend ni otras funciones.

## Decisión sobre confianza: global + confianza por campo nuevo

Mantengo `confianza` global (string `alta|media|baja`) tal como hoy → **no rompe** al front actual (POS/Imputación que ya la leen).

Para los campos nuevos agrego `confianza_campos: { fecha, cuil_titular, titular, banco }` con el mismo enum `alta|media|baja|null`. Es aditivo: el front ignora lo que no conoce hasta que decidamos usarlo.

Alternativa `{ valor, confianza }` por campo la descarto porque cambiaría también la forma de `numero_operacion`/`monto` o dejaría el JSON inconsistente (unos planos, otros anidados).

## JSON de salida propuesto

```json
{
  "numero_operacion": "123456789",
  "monto": "15000.50",
  "fecha": "2026-07-23",
  "cuil_titular": "20304050607",
  "titular": "JUAN PEREZ",
  "banco": "Banco Galicia",
  "confianza": "alta",
  "confianza_campos": {
    "fecha": "alta",
    "cuil_titular": "media",
    "titular": "alta",
    "banco": "baja"
  }
}
```

Reglas de formato (validadas en la edge tras el parse, no solo en el prompt):
- `fecha`: `YYYY-MM-DD` o `null`. Si el comprobante muestra `DD/MM/YYYY` se normaliza; si el año está ambiguo, `null`.
- `cuil_titular`: exactamente 11 dígitos, sin guiones ni espacios, o `null`.
- `monto`: se mantiene tal cual hoy (string) para no romper POS.
- `numero_operacion`: sin cambios.
- Cualquier campo no detectado con seguridad → `null` (y su `confianza_campos` → `"baja"` o `null`).

Si el modelo devuelve algo que no cumple el formato (ej. CUIL de 10 dígitos, fecha inválida), la edge lo fuerza a `null` antes de responder. Nunca inventamos.

## Prompt propuesto para Gemini

System:
```
Sos un asistente especializado en analizar comprobantes de transferencias bancarias argentinas.
Extraé los siguientes campos del comprobante SOLO si están claramente visibles y legibles.

REGLA CRÍTICA: si un campo no aparece, es ambiguo, está tachado, borroso o tenés cualquier duda, devolvé null.
Nunca inventes, adivines ni completes datos faltantes. Es preferible null antes que un valor incorrecto.

Campos a extraer:
- numero_operacion: buscá "Nro. de Operación", "Número de transferencia", "Nro. Transacción",
  "ID de operación", "Comprobante Nro", "Código de transferencia", "Referencia".
- monto: importe transferido, como string sin símbolo de moneda ni separadores de miles
  (usar punto como decimal). Ej: "15000.50".
- fecha: fecha de la operación en formato ESTRICTO YYYY-MM-DD. Si en el comprobante figura
  DD/MM/YYYY, convertila. Si el año no es claro o falta, devolvé null.
- cuil_titular: CUIL/CUIT del titular ordenante o destinatario, EXACTAMENTE 11 dígitos,
  sin guiones ni espacios. Si ves menos o más de 11 dígitos, devolvé null.
- titular: nombre del titular ordenante o destinatario tal como figura, en mayúsculas.
- banco: nombre del banco emisor (ej: "Banco Galicia", "Santander", "BBVA", "Mercado Pago").

Además, para cada campo NUEVO (fecha, cuil_titular, titular, banco) indicá tu nivel de
confianza como "alta", "media" o "baja". Si el valor es null, la confianza debe ser "baja".
También devolvé una confianza GLOBAL "alta"|"media"|"baja" sobre la extracción del
numero_operacion (para compatibilidad).

Respondé SOLO con un JSON válido con este formato EXACTO, sin markdown ni texto extra:
{
  "numero_operacion": string|null,
  "monto": string|null,
  "fecha": string|null,
  "cuil_titular": string|null,
  "titular": string|null,
  "banco": string|null,
  "confianza": "alta"|"media"|"baja",
  "confianza_campos": {
    "fecha": "alta"|"media"|"baja",
    "cuil_titular": "alta"|"media"|"baja",
    "titular": "alta"|"media"|"baja",
    "banco": "alta"|"media"|"baja"
  }
}
```

User (igual que hoy, con imagen adjunta):
```
Analizá este comprobante de transferencia y extraé los campos solicitados.
Recordá: ante cualquier duda, devolvé null en lugar de arriesgar un valor.
```

## Post-procesamiento en la edge (después de parsear JSON del modelo)

1. Si falla el parse → devolver estructura con todos los campos en `null` y confianzas en `"baja"` (comportamiento equivalente al actual pero extendido).
2. Normalizar `cuil_titular`: quitar no-dígitos; si `length !== 11` → `null`.
3. Validar `fecha` con regex `^\d{4}-\d{2}-\d{2}$` y `Date` parse; si inválida → `null`.
4. Trim de `titular` y `banco`; si string vacío → `null`.
5. Coherencia: si un campo quedó `null`, forzar su `confianza_campos` a `"baja"`.

## Compatibilidad
- `numero_operacion`, `monto`, `confianza` conservan nombre, tipo y semántica → POS e Imputación no se ven afectados.
- Campos nuevos son aditivos y opcionales.

## Riesgos
- Aumenta ligeramente latencia y tokens del pedido a Gemini (prompt más largo, más output).
- Modelo `google/gemini-2.5-flash` a veces devuelve strings con formato inconsistente; por eso la edge valida y fuerza `null` post-parse en vez de confiar solo en el prompt.
