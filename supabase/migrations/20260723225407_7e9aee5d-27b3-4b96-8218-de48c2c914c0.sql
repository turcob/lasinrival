CREATE OR REPLACE FUNCTION public.get_factura_saldo_disponible(p_factura_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_priv boolean;
  v_factura record;
  v_venta_id uuid;
  v_venta_owner uuid;
  v_items jsonb;
  v_total_factura numeric;
  v_total_acreditado numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  v_is_priv := public.has_role(v_user, 'admin'::app_role)
            OR public.has_role(v_user, 'encargado'::app_role)
            OR public.has_role(v_user, 'administracion'::app_role);

  SELECT * INTO v_factura FROM public.comprobantes_afip WHERE id = p_factura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  v_venta_id := v_factura.venta_id;

  IF NOT v_is_priv THEN
    IF v_venta_id IS NULL THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
    SELECT usuario_id INTO v_venta_owner FROM public.ventas WHERE id = v_venta_id;
    IF v_venta_owner IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
  END IF;

  v_total_factura := COALESCE(v_factura.importe_total, 0);

  SELECT COALESCE(SUM(importe_total), 0) INTO v_total_acreditado
  FROM public.comprobantes_afip
  WHERE factura_origen_id = p_factura_id
    AND tipo_comprobante IN (3, 8, 13);

  IF v_venta_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'venta_detalle_id', vd.id,
      'producto_id', vd.producto_id,
      'descripcion', COALESCE(p.descripcion, vd.producto_temporal_nombre, 'Producto'),
      'cantidad_facturada', vd.cantidad,
      'precio_unitario', vd.precio_unitario,
      'descuento_porcentaje', COALESCE(vd.descuento_porcentaje, 0),
      'cantidad_acreditada', COALESCE((
        SELECT SUM(nci.cantidad)
        FROM public.nota_credito_items nci
        WHERE nci.venta_detalle_id = vd.id
      ), 0),
      'cantidad_disponible', vd.cantidad - COALESCE((
        SELECT SUM(nci.cantidad)
        FROM public.nota_credito_items nci
        WHERE nci.venta_detalle_id = vd.id
      ), 0)
    )), '[]'::jsonb)
    INTO v_items
    FROM public.venta_detalles vd
    LEFT JOIN public.productos p ON p.id = vd.producto_id
    WHERE vd.venta_id = v_venta_id;
  ELSE
    v_items := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'factura_id', p_factura_id,
    'venta_id', v_venta_id,
    'total_factura', v_total_factura,
    'total_acreditado', v_total_acreditado,
    'monto_disponible', GREATEST(v_total_factura - v_total_acreditado, 0),
    'items', v_items
  );
END;
$function$;