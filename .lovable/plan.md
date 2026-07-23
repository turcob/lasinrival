# Restringir visibilidad de ventas por usuario

## Alcance
Solo la pantalla **Ventas** (via `get_ventas_lista`). RLS de `ventas` y otros módulos (POS, Facturación, NC, Imputación, Liquidación, Dashboard) no se tocan.

## Regla
- No admin/encargado/administracion → ve solo `usuario_id = auth.uid()`.
- Admin/encargado/administracion → ven todo, con select de usuario en la UI.

---

## 1. Migración: `get_ventas_lista`

Se agrega al inicio la detección de rol y se fuerza el filtro en las DOS ramas del UNION (ventas + pedidos). El `p_usuario_id` recibido se ignora salvo que el caller sea privilegiado.

```diff
 CREATE OR REPLACE FUNCTION public.get_ventas_lista(
   p_estado text DEFAULT 'confirmada',
   p_usuario_id uuid DEFAULT NULL,
   ...
 )
 RETURNS TABLE(...)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
 AS $function$
+WITH ctx AS (
+  SELECT
+    auth.uid() AS uid,
+    (
+      public.has_role(auth.uid(), 'admin')
+      OR public.has_role(auth.uid(), 'encargado')
+      OR public.has_role(auth.uid(), 'administracion')
+    ) AS is_priv
+),
-WITH base AS (
+base AS (
   SELECT ..., v.usuario_id, ...
   FROM public.ventas v
   LEFT JOIN public.clientes c ON c.id = v.cliente_id
   LEFT JOIN LATERAL (...) po ON true
+  WHERE
+    (SELECT is_priv FROM ctx)
+    OR v.usuario_id = (SELECT uid FROM ctx)

   UNION ALL

   SELECT ..., p.usuario_id, ...
   FROM public.pedidos p
   LEFT JOIN public.clientes c ON c.id = p.cliente_id
   WHERE p.venta_id IS NULL AND p.tipo_pedido IN ('web','reparto')
+    AND (
+      (SELECT is_priv FROM ctx)
+      OR p.usuario_id = (SELECT uid FROM ctx)
+    )
 ),
 filtered AS (
   SELECT * FROM base
   WHERE (p_estado = 'todos' OR estado = p_estado)
-    AND (p_usuario_id IS NULL OR usuario_id = p_usuario_id)
+    AND (
+      -- privilegiados: respetan el parámetro; no-privilegiados: ya filtrados en base
+      (SELECT is_priv FROM ctx) = false
+      OR p_usuario_id IS NULL
+      OR usuario_id = p_usuario_id
+    )
     AND (...)
 ),
 ...
```

Todo lo demás de la RPC queda igual.

## 2. `src/pages/Ventas.tsx`

Mostrar el select de usuario solo si el rol lo permite. Roles `encargado` y `administracion` se leen con `hasRole`.

```diff
   const { user, hasRole } = useAuth();
+  const puedeVerTodas = hasRole('admin') || hasRole('encargado') || hasRole('administracion');
...
-        <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
-          <SelectTrigger className="w-[180px]">
-            <SelectValue placeholder="Usuario que cargó" />
-          </SelectTrigger>
-          <SelectContent>
-            <SelectItem value="todos">Todos los usuarios</SelectItem>
-            {usuarios.map((u) => (
-              <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
-            ))}
-          </SelectContent>
-        </Select>
+        {puedeVerTodas && (
+          <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
+            <SelectTrigger className="w-[180px]">
+              <SelectValue placeholder="Usuario que cargó" />
+            </SelectTrigger>
+            <SelectContent>
+              <SelectItem value="todos">Todos los usuarios</SelectItem>
+              {usuarios.map((u) => (
+                <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
+              ))}
+            </SelectContent>
+          </Select>
+        )}
```

El backend igual fuerza `auth.uid()` para no-privilegiados, así que aunque un cliente manipule `p_usuario_id`, la RPC lo ignora. La UI solo esconde el control.

## Lo que NO se toca
- RLS de `ventas` (queda `USING true`).
- POS (reimpresión, edición de pedido), Facturación, NotaCreditoParcialWizard, ResolucionesPendientes, Imputación, LiquidacionSection, RegistrarPagoClienteDialog, Dashboard.

## Verificación posterior
- Login con vendedor no-admin → lista solo sus ventas + sus pedidos web/reparto; select de usuario oculto.
- Login admin/encargado → ve todo y puede filtrar por usuario.
- Confirmar que totales, paginación y el resto de filtros siguen respondiendo (la RPC mantiene su firma y semántica para privilegiados).
