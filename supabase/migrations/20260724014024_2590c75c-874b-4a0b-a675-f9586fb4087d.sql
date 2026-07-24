
DROP FUNCTION IF EXISTS public.pos_registrar_venta(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid);

CREATE OR REPLACE FUNCTION public.pos_registrar_venta(
  p_venta jsonb,
  p_detalles jsonb,
  p_pagos jsonb DEFAULT '[]'::jsonb,
  p_caja_movimiento jsonb DEFAULT NULL::jsonb,
  p_cliente_movimiento jsonb DEFAULT NULL::jsonb,
  p_empleado_movimiento jsonb DEFAULT NULL::jsonb,
  p_transferencia jsonb DEFAULT NULL::jsonb,
  p_cheque jsonb DEFAULT NULL::jsonb,
  p_motivo_inventario text DEFAULT 'Venta'::text,
  p_editing_pedido_id uuid DEFAULT NULL::uuid,
  p_pedido_id uuid DEFAULT NULL::uuid
)
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

  -- ============ 0. LOCKS ============
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

    -- Resolver vendedor -> user_id via empleados
    IF v_pedido.vendedor_id IS NOT NULL THEN
      SELECT e.user_id INTO v_vendedor_user_id
      FROM public.vendedores v
      LEFT JOIN public.empleados e ON e.id = v.empleado_id
      WHERE v.id = v_pedido.vendedor_id;
    END IF;

    -- El nuevo flujo mayorista siempre confirma la venta
    v_estado := 'confirmada';
  END IF;

  -- ============ 1. VENTA: crear o actualizar ============
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
      subtotal, descuento, total, estado, vendedor_id
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

  -- ============ 2. DETALLES ============
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

  -- ============ 3. PAGOS ============
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

  -- ============ 4. STOCK + MOVIMIENTOS INVENTARIO ============
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

  -- ============ 5. MOVIMIENTO DE CAJA ============
  IF p_caja_movimiento IS NOT NULL THEN
    v_caja_id := NULLIF(p_caja_movimiento->>'caja_id','')::uuid;
    INSERT INTO public.movimientos_caja (caja_id, usuario_id, tipo, concepto, monto, venta_id)
    VALUES (
      v_caja_id,
      v_user,
      'ingreso',
      COALESCE(p_caja_movimiento->>'concepto', 'Venta #' || v_numero::text),
      (p_caja_movimiento->>'monto')::numeric,
      v_venta_id
    );

    UPDATE public.cajas
       SET total_ventas = COALESCE(total_ventas, 0) + (p_caja_movimiento->>'monto')::numeric
     WHERE id = v_caja_id;
  END IF;

  -- ============ 6. CLIENTE_MOVIMIENTOS ============
  IF p_cliente_movimiento IS NOT NULL THEN
    INSERT INTO public.cliente_movimientos (
      cliente_id, tipo, monto, concepto, venta_id, usuario_registro_id
    ) VALUES (
      (p_cliente_movimiento->>'cliente_id')::uuid,
      COALESCE(p_cliente_movimiento->>'tipo', 'compra'),
      (p_cliente_movimiento->>'monto')::numeric,
      COALESCE(p_cliente_movimiento->>'concepto', 'Compra - Venta #' || v_numero::text),
      v_venta_id,
      v_user
    );
  END IF;

  -- ============ 7. EMPLEADO_MOVIMIENTOS ============
  IF p_empleado_movimiento IS NOT NULL THEN
    INSERT INTO public.empleado_movimientos (
      empleado_id, tipo, monto, concepto, venta_id, usuario_registro_id
    ) VALUES (
      (p_empleado_movimiento->>'empleado_id')::uuid,
      COALESCE(p_empleado_movimiento->>'tipo', 'compra'),
      (p_empleado_movimiento->>'monto')::numeric,
      COALESCE(p_empleado_movimiento->>'concepto', 'Compra - Venta #' || v_numero::text),
      v_venta_id,
      v_user
    );
  END IF;

  -- ============ 8. TRANSFERENCIA ============
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
      'pendiente',
      'venta',
      v_venta_id,
      v_user,
      NULLIF(p_transferencia->>'foto_comprobante_path',''),
      NULLIF(p_transferencia->>'foto_comprobante_nombre','')
    );
  END IF;

  -- ============ 9. CHEQUE ============
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
      v_venta_id,
      v_user
    );
  END IF;

  -- ============ 10. VINCULAR PEDIDO MAYORISTA ============
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
