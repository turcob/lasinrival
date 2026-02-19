
CREATE OR REPLACE FUNCTION public.get_ventas_totales_por_medio_pago(
  p_fecha_desde TIMESTAMPTZ DEFAULT NULL,
  p_fecha_hasta TIMESTAMPTZ DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_estado TEXT DEFAULT 'confirmada'
)
RETURNS TABLE (
  forma_pago_nombre TEXT,
  total NUMERIC,
  count_ventas BIGINT,
  count_pedidos BIGINT,
  total_general NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH ventas_filtradas AS (
    SELECT v.id, v.total, v.estado
    FROM ventas v
    WHERE v.anulada = false
      AND (p_estado = 'todos' OR v.estado = p_estado)
      AND (p_usuario_id IS NULL OR v.usuario_id = p_usuario_id)
      AND (p_fecha_desde IS NULL OR v.fecha >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR v.fecha <= p_fecha_hasta)
  ),
  stats AS (
    SELECT 
      COALESCE(SUM(CASE WHEN vf.estado = 'confirmada' THEN vf.total ELSE 0 END), 0) AS total_gen,
      COUNT(CASE WHEN vf.estado = 'confirmada' THEN 1 END) AS cnt_ventas,
      COUNT(CASE WHEN vf.estado = 'pedido' THEN 1 END) AS cnt_pedidos
    FROM ventas_filtradas vf
  ),
  pagos_agrupados AS (
    SELECT 
      COALESCE(fp.nombre, 'Otro') AS nombre_fp,
      SUM(vp.monto) AS total_fp
    FROM ventas_filtradas vf
    JOIN venta_pagos vp ON vp.venta_id = vf.id
    JOIN formas_pago fp ON fp.id = vp.forma_pago_id
    WHERE vf.estado = 'confirmada'
    GROUP BY fp.nombre
  )
  SELECT 
    pa.nombre_fp,
    pa.total_fp,
    s.cnt_ventas,
    s.cnt_pedidos,
    s.total_gen
  FROM pagos_agrupados pa
  CROSS JOIN stats s
  
  UNION ALL
  
  -- Always return at least one row with stats even if no payments
  SELECT 
    NULL::TEXT,
    0::NUMERIC,
    s.cnt_ventas,
    s.cnt_pedidos,
    s.total_gen
  FROM stats s
  WHERE NOT EXISTS (SELECT 1 FROM pagos_agrupados)
$$;
