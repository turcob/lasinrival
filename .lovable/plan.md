## Objetivo

Que toda NC quede resuelta financieramente **en el mismo acto de emisión**, contra la caja del usuario que la emite, salvo excepción de CC impaga. Precheck obligatorio antes de ir a AFIP, y vinculación atómica NC ↔ movimiento vía RPC.

## Cómo resuelvo la excepción de CC impaga (explícito, antes de aplicar)

Cuando la factura de origen tiene `venta_id`, calculo el saldo impago de esa venta puntual (no del cliente entero):

1. Ubico el movimiento "compra" que la venta generó:
   ```sql
   select id, monto from cliente_movimientos
   where venta_id = :venta_id and tipo = 'compra'
     and coalesce(origen,'sistema') <> 'historico'
   order by created_at asc limit 1;
   ```
2. Calculo lo ya imputado a esa factura:
   ```sql
   select coalesce(sum(monto),0) from cliente_movimiento_imputaciones
   where movimiento_factura_id = :compra_id;
   ```
3. `saldo_impago = max(0, compra.monto - imputado)`.

Con eso reparto el `total_nc`:

- `monto_cc  = min(total_nc, saldo_impago)` → se imputa como NCR contra la deuda.
- `monto_caja = total_nc - monto_cc` → egreso en la caja del emisor.

Casos que quedan cubiertos:

| Escenario | monto_cc | monto_caja | Requiere caja abierta |
|---|---|---|---|
| Venta contado (sin `compra` en CC) | 0 | total_nc | Sí |
| Venta CC ya pagada | 0 | total_nc | Sí (le "devolvés" lo que ya cobraste) |
| Venta CC totalmente impaga y NC ≤ saldo | total_nc | 0 | No |
| Venta CC parcialmente pagada y NC > saldo | saldo_impago | resto | Sí, sólo por el resto |
| NC sin `venta_id` (bonificación suelta) | 0 | total_nc | Sí |

Consumidor Final entra siempre por caja porque no hay `cliente_movimientos` a imputar.

## Precheck antes de AFIP

Se corre **antes** de invocar la edge `afip-facturacion/emitir`. Si falla, no se emite:

- Si `monto_caja > 0` y el usuario no tiene una caja en estado `abierta` (buscada por `usuario_id = auth.uid()`), se bloquea con mensaje:
  > "No podés emitir esta Nota de Crédito: necesitás una caja abierta a tu nombre para registrar el egreso de $X. Abrí tu caja y volvé a intentar."

Se elimina el selector de "elegir caja" para admin: siempre la caja propia del emisor. Menos superficie de error, más trazabilidad.

## Registro atómico post-CAE

Nueva RPC `public.resolver_nota_credito` (SECURITY DEFINER):

```
resolver_nota_credito(
  p_comprobante_nc_id uuid,
  p_caja_id uuid,            -- null si monto_caja = 0
  p_cliente_id uuid,         -- null si monto_cc = 0
  p_monto_caja numeric,
  p_monto_cc numeric,
  p_factura_compra_mov_id uuid, -- para imputación (opcional)
  p_concepto_caja text,
  p_concepto_cc text,
  p_venta_id uuid
) returns jsonb
```

En una única transacción:
1. Bloquea la fila de `comprobantes_afip` con `for update`.
2. Rechaza si ya tiene `resolucion_financiera` (idempotencia).
3. Si `p_monto_caja > 0`: inserta `movimientos_caja` (tipo `egreso`), actualiza `cajas.total_egresos`.
4. Si `p_monto_cc > 0`: inserta `cliente_movimientos` (tipo `nota_credito`) y, si viene `p_factura_compra_mov_id`, inserta `cliente_movimiento_imputaciones` por `p_monto_cc`.
5. `update comprobantes_afip set resolucion_financiera = case when caja>0 and cc>0 then 'mixta' when caja>0 then 'caja' else 'cuenta_corriente' end, caja_movimiento_id = ..., resolucion_cliente_movimiento_id = ..., resolucion_at = now(), resolucion_por = auth.uid()`.
6. Todo en la misma transacción: si falla cualquier paso, `raise` y se revierte.

Los UNIQUE parciales existentes (`comprobantes_afip_caja_mov_uniq`, `comprobantes_afip_cc_mov_uniq`) siguen previniendo doble uso.

Emisión ↔ resolución: como el CAE de AFIP no se puede rollbackear, la garantía viene por el precheck (nunca se llama a AFIP si la caja no está abierta) más la RPC atómica. Si algo excepcional fallara post-CAE (ej. la fila de la NC se guardó pero la RPC falla por race), la NC queda visible en `ResolucionesPendientes` — que sigue funcionando sin cambios.

## Cambios de código

### 1. `supabase/migration` — nueva RPC `resolver_nota_credito`

Contiene la lógica descrita arriba. También agrega `resolucion_financiera in ('caja','cuenta_corriente','mixta')` implícito por uso (no se agrega CHECK para no romper histórico).

### 2. `src/components/facturacion/NotaCreditoParcialWizard.tsx`

- **Cargar caja propia y saldo de CC antes de emitir** (`cargarDatos`):
  - Buscar caja abierta del `user.id`.
  - Si `factura.venta_id`, cargar `compra_mov` y `saldo_impago` (dos selects).
  - Calcular `montoCaja / montoCC` en un `useMemo` a partir del `totalNc`.
- **Deshabilitar el botón "Emitir"** cuando `montoCaja > 0 && !cajaPropia`, con banner rojo indicando el motivo.
- **En `handleEmitir`**, antes del `invoke("afip-facturacion/emitir", ...)`:
  - Re-chequear caja abierta si `montoCaja > 0`. Si no hay → `toast.error` y return sin llamar a AFIP.
- **Reemplazar** todo el bloque de "resolución financiera automática" (líneas 571–644) por una única llamada a `supabase.rpc("resolver_nota_credito", { ... })` con los parámetros calculados. Ya no hay tres inserts sueltos ni actualización manual de `total_egresos`.
- **Eliminar** el modo "post-emisión con selector de caja del admin" (bloque `ncEmitida` en el render, líneas ~660–818, y estados `ncEmitida`, `cajaSeleccionadaId`, `cajasAbiertas`, `confirmarResolucion`, `resolviendo`). Ya no aplica: la resolución es sincrónica con la emisión y siempre en la caja propia.
- Se conserva `tipoResolucionAuto` sólo como label informativo en el paso 4 ("Se descontará $X de tu caja y $Y de la CC del cliente").

### 3. `src/components/facturacion/ResolucionesPendientes.tsx`

**No se toca.** Sigue leyendo NCs con `resolucion_financiera is null` para las históricas. Puede llamar internamente a la nueva RPC en lugar de sus inserts sueltos (mejora opcional), pero fuera del alcance.

## Fuera de alcance

- Cambios en `afip-facturacion` (no se toca).
- Cambio del comportamiento de `ResolucionesPendientes` (sigue igual).
- CHECK constraint sobre `resolucion_financiera` (histórico puede tener otros valores).
- POS / NC desde Ventas: usan el mismo wizard, así que quedan cubiertos por el cambio en `NotaCreditoParcialWizard.tsx`.

## Orden de aplicación

1. Migración con la RPC `resolver_nota_credito`.
2. Cambios en `NotaCreditoParcialWizard.tsx`.

Antes de aplicar te muestro el diff concreto de cada archivo.
