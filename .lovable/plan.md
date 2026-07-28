# Fix redondeo POS — quirúrgico, 3 puntos + prefill tarjeta

Superficie única: `src/pages/POS.tsx`. Sin refactor, sin tocar tolerancias, sin tocar RPC ni payload de factura.

---

## 1. Helper local (nuevo, junto a los `useMemo` de totales, ~L822)

```ts
// Redondeo a 2 decimales (centavos). Local al POS: no reemplaza .toFixed existentes.
const r2 = (n: number) => Math.round(n * 100) / 100;
```

---

## 2. Aplicar `r2` en los 3 puntos que alimentan `totalConRecargo − totalPagado`

### 2.a — `montoConInteres` (L968, `handleAddPagoTarjeta`)

Fuente real del 3er decimal (`monto * coeficiente`).

```diff
-    const coeficiente = cuotaConfig?.coeficiente || 1;
-    const montoConInteres = monto * coeficiente;
-
-    setPagos(prev => [...prev, {
-      forma_pago_id: selectedFormaPago,
-      monto: montoConInteres,
+    const coeficiente = cuotaConfig?.coeficiente || 1;
+    const montoConInteres = r2(monto * coeficiente);
+
+    setPagos(prev => [...prev, {
+      forma_pago_id: selectedFormaPago,
+      monto: montoConInteres,
```

`recargoTarjeta` (L831-836) queda igual: como `p.monto` y `p.monto/coef` ya parten de un valor en centavos, el residuo cae debajo de la tolerancia y `totalConRecargo` se cierra con el r2 del paso 2.c.

### 2.b — `p.monto` al empujar cada medio al array `pagos`

Redondear el monto parseado *justo antes* del `setPagos`, en cada handler:

**Transferencia** (L928-936, `handleConfirmarTransferencia`)
```diff
-    setPagos(prev => {
-      const idx = prev.findIndex(p => p.forma_pago_id === fpTransf.id);
-      if (idx >= 0) {
-        const next = [...prev];
-        next[idx] = { ...next[idx], monto: importeNum };
-        return next;
-      }
-      return [...prev, { forma_pago_id: fpTransf.id, monto: importeNum }];
-    });
+    const importeR = r2(importeNum);
+    setPagos(prev => {
+      const idx = prev.findIndex(p => p.forma_pago_id === fpTransf.id);
+      if (idx >= 0) {
+        const next = [...prev];
+        next[idx] = { ...next[idx], monto: importeR };
+        return next;
+      }
+      return [...prev, { forma_pago_id: fpTransf.id, monto: importeR }];
+    });
```

**Efectivo** (L1002-1016, `handleAddPagoEfectivo`)
```diff
-    const montoAplicado = Math.min(entregado, pendiente);
-    const vuelto = entregado > pendiente ? entregado - pendiente : 0;
+    const montoAplicado = r2(Math.min(entregado, pendiente));
+    const vuelto = entregado > pendiente ? r2(entregado - pendiente) : 0;
```
(`entregado` queda sin redondear en `efectivo_entregado` para no alterar lo que declaró el cliente; el `monto` que suma al total sí queda en centavos.)

**Genérico** (L1141-1149, `handleAddPagoGenerico`) — reemplazar `monto` por `r2(monto)` en los dos ramas del set.

**Cheque** (L1175-1182, `handleAddPagoCheque`) — idem, `monto` → `r2(monto)` en ambas ramas.

**Tarjeta** ya cubierto en 2.a con `r2(monto * coeficiente)`.

### 2.c — `totalConRecargo` (L837)

```diff
-  const totalConRecargo = useMemo(() => total + recargoTarjeta, [total, recargoTarjeta]);
+  const totalConRecargo = useMemo(() => r2(total + recargoTarjeta), [total, recargoTarjeta]);
```

`totalPagado` (L829) ya queda naturalmente en centavos porque cada `p.monto` entra redondeado (2.a + 2.b).

---

## 3. Prefill tarjeta: `.toString()` → `.toFixed(2)` (L1042, L1054, L1066)

```diff
-      const pendiente = totalConRecargo - totalPagado;
-      setMontoTarjeta(pendiente.toString());
+      const pendiente = totalConRecargo - totalPagado;
+      setMontoTarjeta(pendiente.toFixed(2));
```

Los 3 bloques (débito, crédito, tarjeta genérica) — mismo cambio.

---

## Validación aritmética (los 3 escenarios pedidos)

| Escenario | Detalle | Sin fix `totalPagado` | Sin fix `totalConRecargo` | Sin fix diff | Con fix `totalPagado` | Con fix `totalConRecargo` | Con fix diff |
|---|---|---:|---:|---:|---:|---:|---:|
| **a** Efectivo exacto | Total=1000, entrega=1000 | 1000.00 | 1000.00 | 0.00 | 1000.00 | 1000.00 | **0.00** |
| **b** Tarjeta c/ recargo | 1234.56 × 1.15 | 1419.7440000000001 | 1419.7439999999999 | ~2e-13 | 1419.74 | 1419.74 | **0.00** |
| **c** Split transf + efectivo | Total=1000; transf=500.554; efectivo=499.45 | 1000.000 (con residuo float) | 1000.00 | ~e-13 | transf 500.55 + efectivo 499.45 = 1000.00 | 1000.00 | **0.00** |

En los 3 la diff queda dentro del gate `> 0.009` de L873 → **ninguna venta que hoy cierra deja de cerrar**. El caso (b), que hoy visualmente arrastra el 3er decimal (aunque numéricamente cierra por casualidad de float), pasa a cerrar en centavos limpios.

---

## Fuera de alcance (NO se toca — según instrucción)

- **Tolerancias `0.009`**: L873, L923, L1072, L1137, L1171, L3540, L3553 quedan intactas. Quitarlas o modificarlas puede rechazar splits válidos y no es este fix.
- **L1542 `if (totalPagado < totalConRecargo)`** sin tolerancia: **hallazgo** — con los `r2` puestos, ambas partes quedan en centavos y el comparador estricto se vuelve seguro para los 3 escenarios anteriores. Aun así, si en runtime `totalPagado` viniera de un flujo no cubierto (p.ej. edición manual futura), el `<` sin `+ 0.009` podría disparar false negatives. **No se modifica en este fix**; queda listado para decisión posterior.
- `pos_registrar_venta` y payload de facturación (`importe_neto`/`iva` ya usan `toFixed`) — sin cambios.

---

## Deploy

- Cambio 100% front en `src/pages/POS.tsx`.
- Off-hours + aviso vía `UpdateBanner` (versionCheck ya reactivo).
- Rollback: revertir el commit — no hay migración ni cambio de esquema.

Aprobá y aplico el diff tal cual.
