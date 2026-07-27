## Paso c — Grilla de cotejo por medio en cierre y edición

Reemplazar el bloque manual "Comprobantes Posnet y Transferencias" en `Cajas.tsx` y `EditarArqueoDialog.tsx` por una grilla dinámica alimentada por `get_arqueo_por_medio(caja_id)`, y endurecer la policy INSERT de `arqueo_otros_medios`.

Deploy en 3 sub-pasos aprobables por separado.

---

### c.1 — Migración: endurecer policy INSERT de `arqueo_otros_medios`

**Estado actual** (verificado): la policy INSERT tiene `with_check: true` — cualquier authenticated inserta contra cualquier caja. UPDATE/DELETE ya están restringidos a dueño + `arqueo_confirmado = false`.

**Cambio propuesto**:

```sql
DROP POLICY <policy_insert_actual> ON public.arqueo_otros_medios;

CREATE POLICY "Dueño de caja puede insertar arqueo_otros_medios"
  ON public.arqueo_otros_medios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cajas c
      WHERE c.id = arqueo_otros_medios.caja_id
        AND c.usuario_id = auth.uid()
        AND COALESCE(c.arqueo_confirmado, false) = false
    )
  );
```

**Confirmación write path del cajero**: el cajero que cierra su propia caja cumple `c.usuario_id = auth.uid()` y `arqueo_confirmado = false` (recién cerrada, aún sin confirmar por admin) → INSERT pasa. La edición desde `EditarArqueoDialog.tsx` también entra por el dueño con la caja no confirmada → pasa. Admins que quisieran insertar en cajas ajenas no pasarían por esta policy — hoy no hay caso de uso para eso; si aparece, se agrega policy separada con `has_role('admin')`.

**Superficie**: solo DB. Reversible con re-crear la policy antigua. No off-hours.

---

### c.2 — `src/pages/Cajas.tsx` (cierre de caja)

**Cambios**:

1. Al abrir el diálogo de cierre (`cierreDialogOpen = true` para la caja del usuario), llamar `supabase.rpc('get_arqueo_por_medio', { p_caja_id })`. Guardar resultado en `arqueoPorMedio: { categoria, forma_pago_id, forma_pago_nombre, total, cantidad_operaciones }[]`.

2. Agrupar por `categoria` (sumando `total` si hay varias formas por categoría). Categorías a mostrar siempre en este orden: `efectivo`, `debito`, `credito`, `transferencia`, `cheque`, `otro`. Mostrar la fila aunque `esperado = 0` solo si hubo operaciones o si el usuario declara algo (sino se oculta para no ensuciar).

3. Reemplazar el bloque actual "Comprobantes Posnet y Transferencias" (líneas ~1115-1160) por `<Card>` "Cotejo por medio de pago" con:
   - Fila **Efectivo**: `esperado = fondo_inicial + total_efectivo_RPC − total_egresos`. `declarado = totalEfectivo` (del conteo de denominaciones existente, sin input propio en la grilla). Muestra diferencia.
   - Filas **Débito / Crédito / Transferencia / Cheque / Otro**: input numérico con prefill = esperado (editable). Estado local `declaradoPorCategoria: Record<Categoria, number>`.
   - Diferencia por fila: `declarado − esperado`. Clases: `text-success` si `Math.abs(diff) < 0.01`, `text-destructive` en caso contrario. Sin colores hardcoded.
   - Total al pie: suma esperada vs suma declarada + diferencia global (informativa, no toca `cajas.diferencia`).

4. Nota informativa: si `SUM(total_RPC) − (cajas.total_ventas ?? 0) > 0.01`, mostrar aviso "Hay ventas anuladas no reflejadas en el total legacy" con `text-muted-foreground` (caso b.5).

5. Reemplazar `otrosMedios` state (`posnet`, `transferencias`) por `declaradoPorCategoria`. `totalArqueo` recalculado como `totalEfectivo + sum(declaradoPorCategoria en no-efectivo)`.

6. En `handleCerrarCaja`, cambiar los inserts de `arqueo_otros_medios`:
   ```ts
   const inserts = (['debito','credito','transferencia','cheque','otro'] as const)
     .filter(cat => declaradoPorCategoria[cat] > 0 || esperadoPorCategoria[cat] > 0)
     .map(cat => ({
       caja_id,
       tipo: cat,                  // legacy col; usamos categoria como valor
       categoria: cat,
       forma_pago_id: null,        // agregado por categoría
       monto: declaradoPorCategoria[cat] ?? 0,
       esperado: esperadoPorCategoria[cat] ?? 0,
     }));
   ```
   `diferencia` es generated column — no la seteamos.

7. NO tocar `cajas.diferencia` global ni la llamada legacy que la calcula. El cotejo por medio es informativo/persistido, no altera el ajuste a CC del empleado.

**Superficie**: solo `src/pages/Cajas.tsx`. Toca UI con SW → coordinar ventana off-hours + `UpdateBanner` para forzar refresco a cajeros abiertos.

**Confirmación write path**: el cajero dueño con caja no confirmada → policy INSERT de c.1 pasa. ✓

---

### c.3 — `src/components/cajas/EditarArqueoDialog.tsx` (edición post-cierre)

**Cambios**:

1. En `loadArqueoData`, además de leer `arqueo_detalles` y `arqueo_otros_medios`, llamar `get_arqueo_por_medio(caja.id)` para calcular esperados por categoría.

2. Reemplazar el bloque actual (líneas ~270-309) por la misma grilla dinámica de c.2.

3. Prefill del input por categoría:
   - Si existe fila en `arqueo_otros_medios` con esa `categoria` → usar `monto` guardado.
   - Sino, si categoria mapea a legacy (`transferencia` ← `tipo='transferencias'`, `otro` ← `tipo='posnet'`) → usar el monto legacy para no perder datos históricos en la primera edición post-migración.
   - Sino → prefill con el esperado del RPC.

4. En `handleGuardar`, mismo insert nuevo con `categoria`/`esperado` que c.2. Sigue seteando `arqueo_pendiente_revision = true` y `arqueo_confirmado = false` para pasar a revisión de admin.

5. Mostrar diferencia por fila con los mismos tokens semánticos.

**Radix**: se mantiene el `Dialog` existente (no es formulario complejo, ya funciona sin loops). No hace falta migrar a `Sheet`.

**Confirmación write path**: el dueño edita su propia caja aún no confirmada → `usuario_id = auth.uid()` y `arqueo_confirmado = false` → policy INSERT de c.1 pasa. ✓

---

### Restricciones respetadas

- No se toca `pos_registrar_venta`, remitos, ni el estado `despachado`.
- No se hardcodean colores — se usan `text-success`, `text-destructive`, `text-muted-foreground`.
- El total legacy `cajas.diferencia` y `confirmar_arqueo_con_ajuste` quedan intactos.
- Bypass 1K con `.range()` no aplica: el RPC devuelve una fila por forma de pago (máximo ~10-20 filas por caja).

### Categorización de deploy

| Sub-paso | Superficie | Off-hours |
|---|---|---|
| c.1 | DB migration (1 policy) | No |
| c.2 | Front-end `Cajas.tsx` + SW | **Sí — coordinar con UpdateBanner** |
| c.3 | Front-end `EditarArqueoDialog.tsx` + SW | **Sí — junto con c.2** |

Recomiendo aplicar c.1 primero (aprobable sola, sin impacto UI), y luego c.2 + c.3 en la misma ventana off-hours para que el refresco forzado del SW llegue a todos los cajeros a la vez.

Confirmá qué sub-paso arranco y muestro el diff antes de aplicar.