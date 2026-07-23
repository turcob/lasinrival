
# Etapa 0 + Etapa 1 — POS mayorista tras feature flag

## Verificaciones previas (respondidas antes de decidir nada)

### V1. ¿Preparar un pedido descuenta stock?
**No.** `src/components/pedidos/PrepararPedidoDialog.tsx` solo lee `productos.stock_actual` para mostrarlo en pantalla; no hace ningún `UPDATE productos` ni inserta en `movimientos_inventario`. El único punto que descuenta stock en el circuito es `pos_registrar_venta` (bloque 4 "STOCK + MOVIMIENTOS INVENTARIO"). Compatible con lo que se necesita.

### V2. ¿Doble movimiento de caja si el pedido tiene `cobrado_en_entrega=true`?
**Sí, si no lo bloqueamos.** `pedidos.cobrado_en_entrega` y `pedidos.monto_cobrado` los setean `RegistrarCobroDialog` (logística) y `useEncargado`. Esos flujos NO llaman a `pos_registrar_venta`: hoy insertan directo en `cliente_movimientos` (cobro CC) sin generar `movimientos_caja` de la venta (porque la venta todavía no existe). Pero si después el mostrador retoma ese pedido con la nueva rama y cobra, `pos_registrar_venta` volvería a asentar el ingreso completo en caja y el cliente_movimiento de la compra, contando dos veces el mismo dinero.

**Mitigación** (parte de esta etapa): la nueva rama rechaza pedidos con `monto_cobrado > 0` o `cobrado_en_entrega=true`. Si el usuario los intenta cobrar desde el POS, mostrar mensaje explícito y bloquear. Migración de esos casos queda fuera de alcance.

## Atribución del vendedor — opciones a decidir

**Contexto verificado:**
- El vendedor de campo se registra en `pedidos.vendedor_id` (FK a `vendedores`), NO en `pedidos.usuario_id` (usuario que creó la fila).
- **Liquidaciones/comisiones ya se calculan sobre `pedidos.vendedor_id`** (`LiquidacionSection.tsx` L164, L454). No leen `ventas.usuario_id`. Cobrar desde el mostrador NO afecta comisiones hoy.
- El único problema real es visibilidad en `/ventas`: `get_ventas_lista` filtra por `v.usuario_id = auth.uid()` y para pedidos por `p.usuario_id = auth.uid()`. Si el mostrador cobra, el vendedor de campo pierde de vista "su" venta.

### Opción A — No hacer nada
- `ventas.usuario_id` = mostrador. Vendedor no ve la venta en `/ventas`.
- Comisiones: sin impacto (usan `pedidos.vendedor_id`).
- Impacto `get_ventas_lista`: 0.
- Impacto liquidaciones: 0.
- Costo: bajo. Riesgo: el vendedor reclama no ver sus ventas cobradas.

### Opción B — Nuevo campo `ventas.vendedor_id` + visibilidad OR
- Al cobrar un pedido, copiar `pedidos.vendedor_id` (traducido a `user_id` via `empleados.user_id`/`vendedores`) a `ventas.vendedor_id`.
- `get_ventas_lista`: cambiar la cláusula a `v.usuario_id = uid OR v.vendedor_id = uid` (y análogo para `pedidos`). El admin sigue viendo todo.
- Impacto liquidaciones: 0 (siguen usando `pedidos.vendedor_id`, no cambian).
- Costo: 1 columna nueva + 1 RPC modificada + copia en `pos_registrar_venta`.
- Riesgo: bajo. Requiere resolver el mapeo `vendedores → user_id`. Si un vendedor no tiene `user_id` asociado, `vendedor_id` en la venta queda NULL — no rompe nada, solo no gana visibilidad extra.

### Opción C — Sobrescribir `ventas.usuario_id` con el vendedor
- Descartado. Rompe la relación "quién operó la caja" que hoy usan reportes de caja, arqueo y auditoría.

**Necesito que elijas A o B antes de aplicar.** Recomendaría B, pero es tu llamado.

## Alcance a implementar (una vez elegida la opción)

### Etapa 0 — Feature flag
- Migración: `ALTER TABLE public.configuracion_comercio ADD COLUMN pos_flujo_mayorista_activo boolean NOT NULL DEFAULT false;`
- Extender `useConfiguracionComercio` para exponer el flag.
- Con flag=false, cero cambios de comportamiento.

### Etapa 1 — Cobrar pedido preparado
1. **Enum `pedido_estado`**: agregar valor `'facturado'` (`ALTER TYPE public.pedido_estado ADD VALUE IF NOT EXISTS 'facturado';`). Se ejecuta en su propia migración por restricción de Postgres (ADD VALUE no puede usarse en la misma transacción que consultas contra el enum).

2. **Migración de `pos_registrar_venta`** — agregar parámetro opcional `p_pedido_id uuid DEFAULT NULL` (distinto de `p_editing_pedido_id` que es para el legado). Cuando viene:
   - `SET LOCAL lock_timeout = '5s'` + `pg_advisory_xact_lock(hashtext('pos_registrar_venta:pedido_mayorista:' || p_pedido_id))`.
   - `SELECT ... FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE` con validaciones: estado='preparado', `venta_id IS NULL`, `COALESCE(cobrado_en_entrega,false)=false`, `COALESCE(monto_cobrado,0)=0`. `RAISE EXCEPTION` explícito en cada caso.
   - Al final del bloque, `UPDATE public.pedidos SET estado='facturado', venta_id = v_venta_id, updated_at = now() WHERE id = p_pedido_id;`
   - Insertar en `pedido_historial` la transición.
   - (Opción B, si se elige): copiar `vendedor_id` a `ventas.vendedor_id` (requiere agregar la columna en una migración previa).

3. **UI en `POS.tsx`** — nueva rama condicionada al flag:
   - Nueva pantalla/tab "Cobrar pedido preparado" (aparece solo si `pos_flujo_mayorista_activo=true`; sino, todo queda como hoy).
   - Lista de `pedidos` con `estado='preparado'` y `venta_id IS NULL` y `cobrado_en_entrega=false`.
   - Al seleccionar: carga cart desde `pedido_detalles.cantidad_entregada` (fallback a `cantidad_pedida` si es NULL), permite ajuste final de cantidades/precio/descuento (mismo componente de línea).
   - Al confirmar cobro: llama `pos_registrar_venta` con `p_pedido_id` en vez de `p_editing_pedido_id`. Reutiliza toda la pipeline de medios de pago existente.
   - Post-cobro: imprime ticket/factura como el flujo actual.
   - La rama vieja ("Guardar pedido" con `ventas.estado='pedido'` + "Cargar pedido") permanece sin cambios.

4. **Ocultar la pantalla vieja bajo flag**: NO — la conservamos accesible siempre (requisito del rediseño). Solo se agrega la nueva.

## Archivos que se tocan

- Migración 1: `configuracion_comercio.pos_flujo_mayorista_activo`.
- Migración 2: `ALTER TYPE pedido_estado ADD VALUE 'facturado'`.
- Migración 3 (solo Opción B): `ventas.vendedor_id uuid` + index.
- Migración 4: `CREATE OR REPLACE FUNCTION public.pos_registrar_venta(...)` con nuevo parámetro y bloque de pedido mayorista.
- `src/hooks/useConfiguracionComercio.ts` (o donde viva) — exponer flag.
- `src/pages/POS.tsx` — nueva rama + selector de pedido preparado + wiring a la RPC.
- `src/integrations/supabase/types.ts` — regenerado tras migraciones.
- `src/components/pedidos/PrepararPedidoDialog.tsx` — sin cambios (verificado, no afecta stock).

## Qué se puede romper y cómo se prueba

- **Doble facturación de un pedido:** cubierto por advisory lock + validación `venta_id IS NULL`. Test manual: dos pestañas cobrando el mismo pedido — la segunda debe fallar limpiamente.
- **Doble cobro (entrega + POS):** cubierto por validación `cobrado_en_entrega=false AND monto_cobrado=0`. Test: cobrar parcialmente en entrega, intentar cobrar en POS → error explícito.
- **Flag off:** POS luce idéntico a hoy. Test: crear pedido, cobrar por rama vieja "Cargar pedido", verificar que todo funciona.
- **Flag on:** nueva pantalla visible, cobrar un pedido preparado, verificar `pedidos.estado='facturado'`, `pedidos.venta_id`, `ventas.estado='confirmada'`, stock descontado 1 sola vez, `movimientos_caja` con 1 sola entrada, `cliente_movimientos` con 1 sola compra, ticket impreso, AFIP emitido si corresponde.
- **Visibilidad (Opción B):** vendedor de campo entra a `/ventas` y ve la venta cobrada por el mostrador.
- **Regresión legado:** rama `estado='pedido'` en `ventas` sigue funcionando (no se toca `crear_venta_completa` ni la rama `p_editing_pedido_id`).

## Fuera de alcance (etapas siguientes)

- Etapa 2: crear pedidos desde POS (que "Guardar pedido" escriba en `pedidos` en vez de `ventas.estado='pedido'`).
- Migración masiva de `ventas.estado='pedido'` legadas.
- Cobro parcial desde POS de pedidos con `monto_cobrado > 0` (requiere lógica de conciliación separada).

## Decisión que necesito antes de tocar código

Elegí **A** (no propagar vendedor) o **B** (nueva columna `ventas.vendedor_id` + visibilidad OR). El resto del plan no cambia.
