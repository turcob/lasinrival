
-- 1. Renombrar columna e índice
ALTER TABLE public.ventas RENAME COLUMN vendedor_id TO vendedor_user_id;
ALTER INDEX public.ventas_vendedor_id_idx RENAME TO ventas_vendedor_user_id_idx;

-- 2. FK a auth.users
ALTER TABLE public.ventas
  ADD CONSTRAINT ventas_vendedor_user_id_fkey
  FOREIGN KEY (vendedor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Actualizar pos_registrar_venta: cambiar vendedor_id -> vendedor_user_id en el INSERT
CREATE OR REPLACE FUNCTION public.pos_registrar_venta(p_venta jsonb, p_detalles jsonb, p_pagos jsonb DEFAULT '[]'::jsonb, p_caja_movimiento jsonb DEFAULT NULL::jsonb, p_cliente_movimiento jsonb DEFAULT NULL::jsonb, p_empleado_movimiento jsonb DEFAULT NULL::jsonb, p_transferencia jsonb DEFAULT NULL::jsonb, p_cheque jsonb DEFAULT NULL::jsonb, p_motivo_inventario text DEFAULT 'Venta'::text, p_editing_pedido_id uuid DEFAULT NULL::uuid, p_pedido_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_numero integer;
  v_venta_id uuid;
  v_estado text := COALESCE(p_venta->>'estado', 'confirmada');
  v_estado_anterior text;
  v_caja_id uuid;
  v_item jsonb;
  v_prod_id uuid;
  v_cant numeric;
  v_stock_actual numeric;
  v_stock_nuevo numeric;
  v_caja_ajuste numeric;
  v_pedido record;
  v_vendedor_user_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF p_editing_pedido_id IS NOT NULL AND p_pedido_id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede editar y facturar un pedido en la misma operación';
  END IF;

  IF p_editing_pedido_id IS NOT NULL THEN
    SET LOCAL lock_timeout = '5s';
    PERFORM pg_advisory_xact_lock(hashtext('pos_registrar_venta:pedido:' || p_editing_pedido_id::text));
  END IF;

  IF p_pedido_id IS NOT NULL THEN
    SET LOCAL lock_timeout = '5s';
    PERFORM pg_advisory_xact_lock(hashtext('pos_registrar_venta:pedido_mayorista:' || p_pedido_id::text));

    SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pedido no encontrado: %', p_pedido_id;
    END IF;
    IF v_pedido.venta_id IS NOT NULL THEN
      RAISE EXCEPTION 'El pedido % ya fue facturado', p_pedido_id;
    END IF;
    IF v_pedido.estado::text <> 'preparado' THEN
      RAISE EXCEPTION 'Solo se puede facturar un pedido en estado preparado (estado actual: %)', v_pedido.estado;
    END IF;
    IF COALESCE(v_pedido.cobrado_en_entrega, false) THEN
      RAISE EXCEPTION 'El pedido ya fue cobrado en entrega. No se puede volver a cobrar desde el POS.';
    END IF;
    IF COALESCE(v_pedido.monto_cobrado, 0) > 0 THEN
      RAISE EXCEPTION 'El pedido tiene un cobro parcial registrado (monto %). No se puede facturar desde el POS.', v_pedido.monto_cobrado;
    END IF;

    IF v_pedido.vendedor_id IS NOT NULL THEN
      SELECT e.user_id INTO v_vendedor_user_id
      FROM public.vendedores v
      LEFT JOIN public.empleados e ON e.id = v.empleado_id
      WHERE v.id = v_pedido.vendedor_id;
    END IF;

    v_estado := 'confirmada';
  END IF;

  IF p_editing_pedido_id IS NOT NULL THEN
    SELECT estado INTO v_estado_anterior
      FROM public.ventas
     WHERE id = p_editing_pedido_id
     FOR UPDATE;

    IF v_estado_anterior IS NULL THEN
      RAISE EXCEPTION 'Pedido a editar no encontrado: %', p_editing_pedido_id;
    END IF;

    UPDATE public.ventas SET
      cliente_id  = NULLIF(p_venta->>'cliente_id','')::uuid,
      empleado_id = NULLIF(p_venta->>'empleado_id','')::uuid,
      caja_id     = NULLIF(p_venta->>'caja_id','')::uuid,
      subtotal    = COALESCE((p_venta->>'subtotal')::numeric, 0),
      descuento   = COALESCE((p_venta->>'descuento')::numeric, 0),
      total       = COALESCE((p_venta->>'total')::numeric, 0),
      estado      = v_estado,
      fecha       = CASE
                      WHEN v_estado_anterior = 'pedido' AND v_estado = 'confirmada'
                        THEN now()
                      ELSE fecha
                    END
    WHERE id = p_editing_pedido_id
    RETURNING id, numero_comprobante INTO v_venta_id, v_numero;

    DELETE FROM public.venta_detalles WHERE venta_id = v_venta_id;
    DELETE FROM public.venta_pagos WHERE venta_id = v_venta_id;

    SELECT COALESCE(SUM(monto), 0) INTO v_caja_ajuste
    FROM public.movimientos_caja
    WHERE venta_id = v_venta_id AND tipo = 'ingreso';

    IF v_caja_ajuste > 0 THEN
      UPDATE public.cajas c
         SET total_ventas = GREATEST(COALESCE(c.total_ventas, 0) - v_caja_ajuste, 0)
        FROM public.movimientos_caja m
       WHERE m.venta_id = v_venta_id
         AND m.tipo = 'ingreso'
         AND c.id = m.caja_id;
    END IF;

    DELETE FROM public.movimientos_caja WHERE venta_id = v_venta_id;

    FOR v_item IN
      SELECT * FROM public.movimientos_inventario
      WHERE venta_id = v_venta_id
    LOOP
      IF (v_item->>'tipo') = 'salida' THEN
        UPDATE public.productos
          SET stock_actual = COALESCE(stock_actual, 0) + (v_item->>'cantidad')::numeric
          WHERE id = (v_item->>'producto_id')::uuid;
      ELSIF (v_item->>'tipo') = 'entrada' THEN
        UPDATE public.productos
          SET stock_actual = COALESCE(stock_actual, 0) - (v_item->>'cantidad')::numeric
          WHERE id = (v_item->>'producto_id')::uuid;
      END IF;
    END LOOP;

    DELETE FROM public.movimientos_inventario WHERE venta_id = v_venta_id;
    DELETE FROM public.cliente_movimientos    WHERE venta_id = v_venta_id;
    DELETE FROM public.empleado_movimientos   WHERE venta_id = v_venta_id;
    DELETE FROM public.transferencias         WHERE venta_id = v_venta_id;
    DELETE FROM public.cheques                WHERE venta_id = v_venta_id;
  ELSE
    IF v_estado <> 'pedido' THEN
      UPDATE public.ventas_numero_counter
         SET ultimo_numero = ultimo_numero + 1, updated_at = now()
       WHERE id = 1
      RETURNING ultimo_numero INTO v_numero;
    ELSE
      v_numero := NULL;
    END IF;

    INSERT INTO public.ventas (
      numero_comprobante, usuario_id, cliente_id, empleado_id, caja_id,
      subtotal, descuento, total, estado, vendedor_user_id
    ) VALUES (
      v_numero,
      COALESCE(NULLIF(p_venta->>'usuario_id','')::uuid, v_user),
      NULLIF(p_venta->>'cliente_id','')::uuid,
      NULLIF(p_venta->>'empleado_id','')::uuid,
      NULLIF(p_venta->>'caja_id','')::uuid,
      COALESCE((p_venta->>'subtotal')::numeric, 0),
      COALESCE((p_venta->>'descuento')::numeric, 0),
      COALESCE((p_venta->>'total')::numeric, 0),
      v_estado,
      v_vendedor_user_id
    )
    RETURNING id, numero_comprobante INTO v_venta_id, v_numero;
  END IF;

  IF jsonb_array_length(p_detalles) > 0 THEN
    INSERT INTO public.venta_detalles (
      venta_id, producto_id, cantidad, precio_unitario,
      descuento, descuento_porcentaje, subtotal,
      producto_temporal_nombre, producto_temporal_precio
    )
    SELECT
      v_venta_id,
      NULLIF(d->>'producto_id','')::uuid,
      (d->>'cantidad')::numeric,
      (d->>'precio_unitario')::numeric,
      COALESCE((d->>'descuento')::numeric, 0),
      COALESCE((d->>'descuento_porcentaje')::numeric, 0),
      (d->>'subtotal')::numeric,
      d->>'producto_temporal_nombre',
      NULLIF(d->>'producto_temporal_precio','')::numeric
    FROM jsonb_array_elements(p_detalles) d;
  END IF;

  IF jsonb_array_length(p_pagos) > 0 THEN
    INSERT INTO public.venta_pagos (
      venta_id, forma_pago_id, monto, tarjeta_id, cuotas, coeficiente,
      efectivo_entregado, vuelto, terminal, lote
    )
    SELECT
      v_venta_id,
      (p->>'forma_pago_id')::uuid,
      (p->>'monto')::numeric,
      NULLIF(p->>'tarjeta_id','')::uuid,
      NULLIF(p->>'cuotas','')::integer,
      NULLIF(p->>'coeficiente','')::numeric,
      NULLIF(p->>'efectivo_entregado','')::numeric,
      NULLIF(p->>'vuelto','')::numeric,
      NULLIF(p->>'terminal',''),
      NULLIF(p->>'lote','')
    FROM jsonb_array_elements(p_pagos) p;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles)
  LOOP
    v_prod_id := NULLIF(v_item->>'producto_id','')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;

    IF v_prod_id IS NOT NULL AND COALESCE((v_item->>'es_temporal')::boolean, false) = false THEN
      SELECT stock_actual INTO v_stock_actual
      FROM public.productos
      WHERE id = v_prod_id
      FOR UPDATE;

      IF v_stock_actual IS NULL THEN
        v_stock_actual := 0;
      END IF;
      v_stock_nuevo := v_stock_actual - v_cant;

      UPDATE public.productos
         SET stock_actual = v_stock_nuevo
       WHERE id = v_prod_id;

      INSERT INTO public.movimientos_inventario (
        producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
        motivo, usuario_id, venta_id
      ) VALUES (
        v_prod_id, 'salida', v_cant, v_stock_actual, v_stock_nuevo,
        p_motivo_inventario, v_user, v_venta_id
      );
    END IF;
  END LOOP;

  IF p_caja_movimiento IS NOT NULL THEN
    v_caja_id := NULLIF(p_caja_movimiento->>'caja_id','')::uuid;
    INSERT INTO public.movimientos_caja (caja_id, usuario_id, tipo, concepto, monto, venta_id)
    VALUES (
      v_caja_id, v_user, 'ingreso',
      COALESCE(p_caja_movimiento->>'concepto', 'Venta #' || v_numero::text),
      (p_caja_movimiento->>'monto')::numeric, v_venta_id
    );

    UPDATE public.cajas
       SET total_ventas = COALESCE(total_ventas, 0) + (p_caja_movimiento->>'monto')::numeric
     WHERE id = v_caja_id;
  END IF;

  IF p_cliente_movimiento IS NOT NULL THEN
    INSERT INTO public.cliente_movimientos (
      cliente_id, tipo, monto, concepto, venta_id, usuario_registro_id
    ) VALUES (
      (p_cliente_movimiento->>'cliente_id')::uuid,
      COALESCE(p_cliente_movimiento->>'tipo', 'compra'),
      (p_cliente_movimiento->>'monto')::numeric,
      COALESCE(p_cliente_movimiento->>'concepto', 'Compra - Venta #' || v_numero::text),
      v_venta_id, v_user
    );
  END IF;

  IF p_empleado_movimiento IS NOT NULL THEN
    INSERT INTO public.empleado_movimientos (
      empleado_id, tipo, monto, concepto, venta_id, usuario_registro_id
    ) VALUES (
      (p_empleado_movimiento->>'empleado_id')::uuid,
      COALESCE(p_empleado_movimiento->>'tipo', 'compra'),
      (p_empleado_movimiento->>'monto')::numeric,
      COALESCE(p_empleado_movimiento->>'concepto', 'Compra - Venta #' || v_numero::text),
      v_venta_id, v_user
    );
  END IF;

  IF p_transferencia IS NOT NULL THEN
    INSERT INTO public.transferencias (
      fecha_transferencia, cliente_id, titular_nombre, titular_cuil,
      numero_operacion, importe, estado, origen, venta_id, creado_por,
      foto_comprobante_path, foto_comprobante_nombre
    ) VALUES (
      COALESCE((p_transferencia->>'fecha_transferencia')::date, CURRENT_DATE),
      NULLIF(p_transferencia->>'cliente_id','')::uuid,
      NULLIF(p_transferencia->>'titular_nombre',''),
      NULLIF(p_transferencia->>'titular_cuil',''),
      NULLIF(p_transferencia->>'numero_operacion',''),
      (p_transferencia->>'importe')::numeric,
      'pendiente', 'venta', v_venta_id, v_user,
      NULLIF(p_transferencia->>'foto_comprobante_path',''),
      NULLIF(p_transferencia->>'foto_comprobante_nombre','')
    );
  END IF;

  IF p_cheque IS NOT NULL THEN
    INSERT INTO public.cheques (
      tipo, estado, numero_cheque, banco, sucursal_banco, emisor, cuit_emisor,
      cliente_id, monto, fecha_emision, fecha_vencimiento, observaciones,
      venta_id, usuario_registro_id
    ) VALUES (
      COALESCE(p_cheque->>'tipo', 'terceros')::cheque_tipo,
      'pendiente_validacion'::cheque_estado,
      p_cheque->>'numero_cheque',
      p_cheque->>'banco',
      NULLIF(p_cheque->>'sucursal_banco',''),
      p_cheque->>'emisor',
      NULLIF(p_cheque->>'cuit_emisor',''),
      NULLIF(p_cheque->>'cliente_id','')::uuid,
      (p_cheque->>'monto')::numeric,
      (p_cheque->>'fecha_emision')::date,
      (p_cheque->>'fecha_vencimiento')::date,
      NULLIF(p_cheque->>'observaciones',''),
      v_venta_id, v_user
    );
  END IF;

  IF p_pedido_id IS NOT NULL THEN
    UPDATE public.pedidos
       SET estado = 'facturado'::public.pedido_estado,
           venta_id = v_venta_id,
           updated_at = now()
     WHERE id = p_pedido_id;

    INSERT INTO public.pedido_historial (
      pedido_id, estado_anterior, estado_nuevo, usuario_id, observaciones
    ) VALUES (
      p_pedido_id, 'preparado', 'facturado', v_user,
      'Pedido facturado desde POS - Venta #' || COALESCE(v_numero::text, v_venta_id::text)
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_venta_id,
    'numero_comprobante', v_numero,
    'pedido_id', p_pedido_id
  );
END;
$function$;

-- 4. Actualizar get_ventas_lista: renombrar campo + OR sobre vendedor en pedidos
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
     OR v.vendedor_user_id = (SELECT uid FROM ctx)

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
  LEFT JOIN public.vendedores vd ON vd.id = p.vendedor_id
  LEFT JOIN public.empleados e_vd ON e_vd.id = vd.empleado_id
  WHERE p.venta_id IS NULL AND p.tipo_pedido IN ('web','reparto')
    AND (
      (SELECT is_priv FROM ctx)
      OR p.usuario_id = (SELECT uid FROM ctx)
      OR e_vd.user_id = (SELECT uid FROM ctx)
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
