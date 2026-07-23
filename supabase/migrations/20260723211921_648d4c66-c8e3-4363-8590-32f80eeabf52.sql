CREATE OR REPLACE FUNCTION public.get_ventas_lista(p_estado text DEFAULT 'confirmada'::text, p_usuario_id uuid DEFAULT NULL::uuid, p_vendedor_id uuid DEFAULT NULL::uuid, p_sin_vendedor boolean DEFAULT false, p_origen text DEFAULT NULL::text, p_fecha_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_fecha_hasta timestamp with time zone DEFAULT NULL::timestamp with time zone, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, es_pedido boolean, numero_comprobante integer, fecha timestamp with time zone, subtotal numeric, descuento numeric, total numeric, anulada boolean, motivo_anulacion text, fecha_anulacion timestamp with time zone, usuario_id uuid, cliente_id uuid, caja_id uuid, estado text, pedido_id uuid, tipo_pedido text, pedido_estado text, origen text, cliente_nombre text, cliente_dni_cuit text, cliente_condicion_iva integer, cliente_vendedor_id uuid, usuario_nombre text, afip jsonb, pagos jsonb, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH ctx AS (
  SELECT
    auth.uid() AS uid,
    (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'encargado'::app_role)
      OR public.has_role(auth.uid(), 'administracion'::app_role)
    ) AS is_priv
),
base AS (
  SELECT
    v.id,
    false AS es_pedido,
    v.numero_comprobante,
    v.fecha,
    v.subtotal, v.descuento, v.total,
    v.anulada, v.motivo_anulacion, v.fecha_anulacion,
    v.usuario_id, v.cliente_id, v.caja_id, v.estado,
    NULL::uuid AS pedido_id,
    NULL::text AS tipo_pedido,
    NULL::text AS pedido_estado,
    COALESCE(po.tipo_pedido, 'mostrador') AS origen,
    c.nombre AS cliente_nombre,
    c.dni_cuit AS cliente_dni_cuit,
    c.condicion_iva AS cliente_condicion_iva,
    c.vendedor_id AS cliente_vendedor_id
  FROM public.ventas v
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  LEFT JOIN LATERAL (
    SELECT p.tipo_pedido FROM public.pedidos p
    WHERE p.venta_id = v.id LIMIT 1
  ) po ON true
  WHERE (SELECT is_priv FROM ctx)
     OR v.usuario_id = (SELECT uid FROM ctx)

  UNION ALL

  SELECT
    p.id,
    true,
    p.numero_pedido,
    p.fecha_pedido,
    p.subtotal, p.descuento, p.total,
    false, NULL::text, NULL::timestamptz,
    p.usuario_id, p.cliente_id, NULL::uuid, p.estado::text,
    p.id, p.tipo_pedido, p.estado::text,
    p.tipo_pedido,
    c.nombre, c.dni_cuit, c.condicion_iva, c.vendedor_id
  FROM public.pedidos p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.venta_id IS NULL AND p.tipo_pedido IN ('web','reparto')
    AND (
      (SELECT is_priv FROM ctx)
      OR p.usuario_id = (SELECT uid FROM ctx)
    )
),
filtered AS (
  SELECT * FROM base
  WHERE (p_estado = 'todos' OR estado = p_estado)
    AND (
      (SELECT is_priv FROM ctx) = false
      OR p_usuario_id IS NULL
      OR usuario_id = p_usuario_id
    )
    AND (
      (NOT p_sin_vendedor AND p_vendedor_id IS NULL)
      OR (p_sin_vendedor AND cliente_vendedor_id IS NULL)
      OR (p_vendedor_id IS NOT NULL AND cliente_vendedor_id = p_vendedor_id)
    )
    AND (p_origen IS NULL OR origen = p_origen)
    AND (p_fecha_desde IS NULL OR fecha >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR fecha <= p_fecha_hasta)
    AND (p_search IS NULL OR numero_comprobante::text LIKE p_search || '%')
),
counted AS (
  SELECT *, count(*) OVER() AS total_count FROM filtered
)
SELECT
  c.id, c.es_pedido, c.numero_comprobante, c.fecha,
  c.subtotal, c.descuento, c.total,
  c.anulada, c.motivo_anulacion, c.fecha_anulacion,
  c.usuario_id, c.cliente_id, c.caja_id, c.estado,
  c.pedido_id, c.tipo_pedido, c.pedido_estado, c.origen,
  c.cliente_nombre, c.cliente_dni_cuit, c.cliente_condicion_iva, c.cliente_vendedor_id,
  pr.nombre AS usuario_nombre,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(ca.*))
    FROM public.comprobantes_afip ca
    WHERE ca.venta_id = c.id
  ), '[]'::jsonb) AS afip,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', vp.id, 'monto', vp.monto,
      'forma_pago_nombre', fp.nombre
    ))
    FROM public.venta_pagos vp
    LEFT JOIN public.formas_pago fp ON fp.id = vp.forma_pago_id
    WHERE vp.venta_id = c.id
  ), '[]'::jsonb) AS pagos,
  c.total_count
FROM counted c
LEFT JOIN public.profiles pr ON pr.id = c.usuario_id
ORDER BY c.fecha DESC
LIMIT p_limit OFFSET p_offset;
$function$;