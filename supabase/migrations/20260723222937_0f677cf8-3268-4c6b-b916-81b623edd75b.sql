
CREATE OR REPLACE FUNCTION public.resolver_nota_credito(
  p_comprobante_nc_id uuid,
  p_caja_id uuid,
  p_cliente_id uuid,
  p_monto_caja numeric,
  p_monto_cc numeric,
  p_factura_compra_mov_id uuid,
  p_concepto_caja text,
  p_concepto_cc text,
  p_venta_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nc record;
  v_caja_mov_id uuid;
  v_cc_mov_id uuid;
  v_resolucion text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT id, resolucion_financiera, importe_total
    INTO v_nc
    FROM public.comprobantes_afip
   WHERE id = p_comprobante_nc_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota de crédito no encontrada';
  END IF;

  IF v_nc.resolucion_financiera IS NOT NULL THEN
    RAISE EXCEPTION 'La NC ya tiene una resolución financiera aplicada (%)', v_nc.resolucion_financiera;
  END IF;

  IF COALESCE(p_monto_caja, 0) < 0 OR COALESCE(p_monto_cc, 0) < 0 THEN
    RAISE EXCEPTION 'Los montos no pueden ser negativos';
  END IF;

  IF COALESCE(p_monto_caja, 0) + COALESCE(p_monto_cc, 0) <= 0 THEN
    RAISE EXCEPTION 'El total a resolver debe ser mayor a 0';
  END IF;

  IF ABS((COALESCE(p_monto_caja,0) + COALESCE(p_monto_cc,0)) - v_nc.importe_total) > 0.02 THEN
    RAISE EXCEPTION 'La suma de caja (%) y CC (%) no coincide con el total de la NC (%)',
      p_monto_caja, p_monto_cc, v_nc.importe_total;
  END IF;

  -- 1. Egreso en caja
  IF COALESCE(p_monto_caja, 0) > 0 THEN
    IF p_caja_id IS NULL THEN
      RAISE EXCEPTION 'Falta la caja para registrar el egreso';
    END IF;

    -- Validar que la caja esté abierta
    PERFORM 1 FROM public.cajas
     WHERE id = p_caja_id AND estado = 'abierta'
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La caja indicada no está abierta';
    END IF;

    INSERT INTO public.movimientos_caja (caja_id, usuario_id, tipo, concepto, monto, venta_id)
    VALUES (p_caja_id, v_user, 'egreso', p_concepto_caja, p_monto_caja, p_venta_id)
    RETURNING id INTO v_caja_mov_id;

    UPDATE public.cajas
       SET total_egresos = COALESCE(total_egresos, 0) + p_monto_caja
     WHERE id = p_caja_id;
  END IF;

  -- 2. Crédito en cuenta corriente
  IF COALESCE(p_monto_cc, 0) > 0 THEN
    IF p_cliente_id IS NULL THEN
      RAISE EXCEPTION 'Falta el cliente para imputar el crédito en CC';
    END IF;

    INSERT INTO public.cliente_movimientos (
      cliente_id, tipo, monto, concepto, venta_id, usuario_registro_id
    ) VALUES (
      p_cliente_id, 'nota_credito', p_monto_cc, p_concepto_cc, p_venta_id, v_user
    ) RETURNING id INTO v_cc_mov_id;

    -- Imputar contra la factura original si se indica
    IF p_factura_compra_mov_id IS NOT NULL THEN
      INSERT INTO public.cliente_movimiento_imputaciones (
        movimiento_pago_id, movimiento_factura_id, monto
      ) VALUES (
        v_cc_mov_id, p_factura_compra_mov_id, p_monto_cc
      );
    END IF;
  END IF;

  v_resolucion := CASE
    WHEN COALESCE(p_monto_caja,0) > 0 AND COALESCE(p_monto_cc,0) > 0 THEN 'mixta'
    WHEN COALESCE(p_monto_caja,0) > 0 THEN 'caja'
    ELSE 'cuenta_corriente'
  END;

  UPDATE public.comprobantes_afip
     SET resolucion_financiera = v_resolucion,
         caja_movimiento_id = v_caja_mov_id,
         resolucion_cliente_movimiento_id = v_cc_mov_id,
         resolucion_at = now(),
         resolucion_por = v_user
   WHERE id = p_comprobante_nc_id;

  RETURN jsonb_build_object(
    'resolucion_financiera', v_resolucion,
    'caja_movimiento_id', v_caja_mov_id,
    'cliente_movimiento_id', v_cc_mov_id
  );
END;
$$;
