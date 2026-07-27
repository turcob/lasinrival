## Paso d — Persistencia de `esperado` + `diferencia` por medio en `arqueo_otros_medios`

Extensión chica de la tabla existente (sin tabla nueva), con backfill legacy y sin tocar caminos críticos.

### Verificaciones previas (read-only, hechas)

**Semántica de `monto`.** En todos los read/write paths existentes `monto` = "declarado por el cajero":
- `src/pages/Cajas.tsx` (cierre): inserta `monto: otrosMedios.posnet` / `monto: otrosMedios.transferencias` desde inputs del cajero.
- `src/components/cajas/EditarArqueoDialog.tsx`: idem.
- `src/components/cajas/ConfirmarArqueoDialog.tsx`: lee `monto` y lo suma como "total otros medios" declarado.

No hay otro read path con semántica distinta. Podemos colgar `diferencia = monto - esperado` con seguridad.

**Tipo de `monto`.** `numeric` sin escala explícita (`min=71.76`, `max=3.631.856`). `esperado numeric(12,2)` y la resta `monto - esperado` no rompen (Postgres promueve al tipo más ancho). La columna generated queda como `numeric` (sin `(12,2)` para no perder decimales si `monto` tiene más de 2).

**Filas legacy actuales.**
- `tipo = 'posnet'` → 82 filas.
- `tipo = 'transferencias'` → 197 filas.

**RLS.** Policies existentes de `arqueo_otros_medios`:
- INSERT: `with_check: true` (cualquier authenticated).
- UPDATE/DELETE: dueño de la caja con `arqueo_confirmado = false`.
- SELECT: `true`.

Las nuevas columnas quedan cubiertas por las mismas policies (no hay filtros por columna). **No hace falta policy nueva.** Grants existentes ya alcanzan.

### Migración propuesta

```sql
-- 1. Columnas nuevas
ALTER TABLE public.arqueo_otros_medios
  ADD COLUMN categoria text
    CHECK (categoria IN ('efectivo','debito','credito','transferencia','cheque','otro')),
  ADD COLUMN forma_pago_id uuid NULL REFERENCES public.formas_pago(id),
  ADD COLUMN esperado numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Generated column (después de tener esperado con default)
ALTER TABLE public.arqueo_otros_medios
  ADD COLUMN diferencia numeric GENERATED ALWAYS AS (monto - esperado) STORED;

-- 3. Backfill legacy
UPDATE public.arqueo_otros_medios
   SET categoria = 'transferencia'
 WHERE tipo = 'transferencias' AND categoria IS NULL;

UPDATE public.arqueo_otros_medios
   SET categoria = 'otro'
 WHERE tipo = 'posnet' AND categoria IS NULL;
-- posnet mezcla débito+crédito: se recategoriza desde el flujo nuevo.
```

- `categoria` queda **nullable** a propósito para no romper filas legacy; el write path nuevo (paso c/d front) siempre la setea.
- `forma_pago_id` nullable — legacy no lo tiene; el flujo nuevo lo completará cuando el desglose sea por forma puntual.
- `esperado = 0` en legacy → `diferencia = monto` para esas filas (esperado, no teníamos el dato).
- Se **mantiene** `tipo` (legacy). El flujo nuevo usa `categoria`.

### Restricciones respetadas

- No se toca `cajas.diferencia` (global) ni `confirmar_arqueo_con_ajuste`. El ajuste a CC del empleado sigue por el path legacy.
- No se toca `pos_registrar_venta` ni cobros.
- No se abren permisos: RLS actual cubre las nuevas columnas.

### Estado esperado tras el backfill

Después de aplicar, deberíamos ver:

```
tipo             | categoria       | filas
transferencias   | transferencia   | 197
posnet           | otro            | 82
(cualquier otro) | NULL            | 0
```

Y para todas: `esperado = 0`, `diferencia = monto`. Lo confirmo con un `SELECT` post-migration antes de dar por cerrado el paso.

### Superficie de deploy

- **Solo DB migration.** ALTERs de columnas + backfill sobre 279 filas.
- **Sin ventana off-hours.** `ADD COLUMN` con default constante es metadata-only en Postgres 11+. La generated column exige rewrite pero la tabla es chica (<300 filas). El backfill es un UPDATE trivial.
- Reversible: `ALTER TABLE ... DROP COLUMN diferencia, DROP COLUMN esperado, DROP COLUMN forma_pago_id, DROP COLUMN categoria;`

Confirmá y aplico.
