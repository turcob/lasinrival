## Paso b — RPC `get_arqueo_por_medio(p_caja_id uuid)`

Función de solo lectura, `SECURITY DEFINER`, con control de acceso interno.

### Elección de lenguaje: `plpgsql`

`LANGUAGE sql` no permite `RAISE EXCEPTION` ni ramificación de control condicional previa al `SELECT`. Como necesitamos rechazar con mensaje explícito antes de devolver filas, uso `plpgsql` con `RETURN QUERY`. Sigue siendo `STABLE` (solo lecturas).

### SQL propuesto

```sql
CREATE OR REPLACE FUNCTION public.get_arqueo_por_medio(p_caja_id uuid)
RETURNS TABLE (
  categoria text,
  forma_pago_id uuid,
  forma_pago_nombre text,
  total numeric,
  cantidad_operaciones bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT usuario_id INTO v_owner
  FROM public.cajas
  WHERE id = p_caja_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada';
  END IF;

  IF v_owner IS DISTINCT FROM v_user
     AND NOT public.has_role(v_user, 'admin'::app_role)
     AND NOT public.has_role(v_user, 'encargado'::app_role) THEN
    RAISE EXCEPTION 'No tenés permiso para ver el arqueo de esta caja';
  END IF;

  RETURN QUERY
  SELECT
    fp.categoria,
    fp.id  AS forma_pago_id,
    fp.nombre AS forma_pago_nombre,
    SUM(vp.monto)::numeric AS total,
    COUNT(*)::bigint       AS cantidad_operaciones
  FROM public.venta_pagos vp
  JOIN public.ventas v      ON v.id = vp.venta_id
  JOIN public.formas_pago fp ON fp.id = vp.forma_pago_id
  WHERE v.caja_id = p_caja_id
    AND v.anulada = false
    AND v.estado  = 'confirmada'
  GROUP BY fp.categoria, fp.id, fp.nombre
  ORDER BY fp.categoria, fp.nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.get_arqueo_por_medio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_arqueo_por_medio(uuid) TO authenticated;
```

### Notas de diseño

- **Filtro exacto** al validado en EVAL b.5: `anulada = false AND estado = 'confirmada'`. En cajas limpias empata al centavo con `cajas.total_ventas`; en cajas con anuladas post-cierre devuelve el número real cobrado.
- **No incluye** `fondo_inicial` ni egresos — eso queda para el paso c (front global).
- **Acceso**: dueño de la caja (`cajas.usuario_id = auth.uid()`), o roles `admin` / `encargado`. Se omite `administracion` por pedido explícito.
- **Sin `.in()` ni listas grandes**: todo se resuelve con joins server-side.
- **No toca** `pos_registrar_venta`, tablas ni otras RPCs.

### Superficie de deploy

- **Solo DB migration** (creación/replace de función + GRANT).
- **Sin ventana off-hours**. `CREATE OR REPLACE FUNCTION` es instantáneo, sin locks sobre tablas.
- Reversible con `DROP FUNCTION public.get_arqueo_por_medio(uuid);`.

Confirmá y aplico.
