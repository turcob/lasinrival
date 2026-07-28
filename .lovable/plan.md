
Diffs por sub-punto, aprobación individual. P2/P5 se pueden aplicar ya; P1/P3/P4 son front (off-hours + UpdateBanner).

---

## P1 — Duplicados en `handleCerrarCaja` (Cajas.tsx ~512) — front

Replicar delete-then-insert como en `EditarArqueoDialog.handleGuardar`. El DELETE corre antes del cambio de estado a `cerrada`+`arqueo_confirmado=true` (la policy endurecida de c.1 permite delete al dueño mientras `arqueo_confirmado=false`, que es el estado en ese momento). Además limpia legacy (`categoria NULL`) preexistente para esa caja.

```diff
@@ src/pages/Cajas.tsx  handleCerrarCaja
       // Guardar arqueo por categoría (grilla dinámica)
+      // Delete-then-insert para evitar duplicados si el cierre se reintenta,
+      // y limpia filas legacy (categoria NULL) preexistentes de esa caja.
+      await supabase.from('arqueo_otros_medios').delete().eq('caja_id', cajaParaCerrar.id);
+
       const otrosMediosInserts = CATEGORIAS_NO_EFECTIVO
```

Nota: el UPDATE de `cajas` a estado cerrado ya corrió arriba (línea ~490). Verificar que la policy de DELETE de `arqueo_otros_medios` no dependa de `cajas.estado='abierta'` — sí depende sólo de `arqueo_confirmado=false`, que en este punto sigue false. Si en producción la policy exige `estado='abierta'`, mover el bloque DELETE+INSERT antes del UPDATE de estado.

---

## P2 — Limpieza correctiva de duplicados (DB, sin off-hours)

Conteo actual (ya medido):
- `dup_cat` (misma `caja_id + categoria` repetida, `categoria` no NULL): **28 filas en 24 cajas**.
- `coexist_legacy_new` (fila legacy conviviendo con nueva del mismo tipo): **0**.

Propuesta: DELETE de duplicados dejando la fila con `esperado` no NULL más reciente (`created_at DESC`). Migración:

```sql
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY caja_id, categoria
           ORDER BY (esperado IS NOT NULL) DESC, created_at DESC
         ) rn
  FROM public.arqueo_otros_medios
  WHERE categoria IS NOT NULL
)
DELETE FROM public.arqueo_otros_medios a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;
```

Opcional refuerzo (índice único) para prevenir reincidencia — a decidir en aprobación:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_arqueo_otros_medios_caja_cat
  ON public.arqueo_otros_medios (caja_id, categoria)
  WHERE categoria IS NOT NULL;
```

---

## P3 — Nota de divergencia (Cajas.tsx ~1239) — front

```diff
-                  if (totalRpc - totalLegacy > 0.01) {
+                  if (Math.abs(totalRpc - totalLegacy) > 0.01) {
                     return (
                       <p className="text-xs text-muted-foreground pt-2 border-t">
-                        Hay ventas anuladas no reflejadas en el total legacy (diferencia informativa: ${(totalRpc - totalLegacy).toLocaleString('es-AR', { minimumFractionDigits: 2 })}).
+                        El total por medio no coincide con el total registrado de la caja (posibles ventas anuladas u otros ajustes). Diferencia informativa: ${(totalRpc - totalLegacy).toLocaleString('es-AR', { minimumFractionDigits: 2 })}.
                       </p>
                     );
                   }
```

---

## P4 — Prefill legacy en `EditarArqueoDialog` (~120-139) — front

Eliminar fallback a `porTipoLegacy` (posnet/transferencias). Sólo: fila nueva con `categoria` → esperado RPC.

```diff
@@ src/components/cajas/EditarArqueoDialog.tsx loadArqueoData
-      const dec: Record<CategoriaMedio, number> = { ...esp };
-      const otros = (otrosRes.data || []) as Array<{ tipo: string; monto: number; categoria?: string | null }>;
-      // Índices por categoria y por tipo legacy
-      const porCategoria = new Map<string, number>();
-      const porTipoLegacy = new Map<string, number>();
-      for (const o of otros) {
-        if (o.categoria) porCategoria.set(o.categoria, Number(o.monto) || 0);
-        porTipoLegacy.set(o.tipo, Number(o.monto) || 0);
-      }
-      for (const cat of CATEGORIAS_NO_EFECTIVO) {
-        if (porCategoria.has(cat)) {
-          dec[cat] = porCategoria.get(cat) || 0;
-        } else if (cat === 'transferencia' && porTipoLegacy.has('transferencias')) {
-          dec[cat] = porTipoLegacy.get('transferencias') || 0;
-        } else if (cat === 'otro' && porTipoLegacy.has('posnet')) {
-          dec[cat] = porTipoLegacy.get('posnet') || 0;
-        }
-      }
+      // Prefill: fila nueva con `categoria` → si no, esperado del RPC.
+      // Legacy (posnet/transferencias sin categoria) queda en BD para auditoría,
+      // no se inyecta al input (posnet mezcla débito+crédito y duplicaría el conteo).
+      const dec: Record<CategoriaMedio, number> = { ...esp };
+      const porCategoria = new Map<string, number>();
+      for (const o of (otrosRes.data || []) as Array<{ monto: number; categoria?: string | null }>) {
+        if (o.categoria) porCategoria.set(o.categoria, Number(o.monto) || 0);
+      }
+      for (const cat of CATEGORIAS_NO_EFECTIVO) {
+        if (porCategoria.has(cat)) dec[cat] = porCategoria.get(cat) || 0;
+      }
       setDeclaradoPorCategoria(dec);
```

---

## P5 — QR → transferencia (DB, sin off-hours)

Fila actual: `id=4d814345-…, nombre=QR, categoria=otro, activo=true`.

```sql
UPDATE public.formas_pago SET categoria = 'transferencia' WHERE nombre = 'QR';
```

Devolveré la fila resultante tras aplicar.

---

## Orden sugerido

1. **P5** (UPDATE 1 fila, inmediato).
2. **P2** (limpieza duplicados; opcional índice único).
3. **P1 + P3 + P4** en un solo deploy front, off-hours + aviso vía UpdateBanner.

Aprobá sub-punto por sub-punto (P1/P2/P3/P4/P5) y aplico.
