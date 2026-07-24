
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS preparado_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparado_por uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.pos_actualizar_pedido_estado(
  p_venta_id uuid,
  p_nuevo_estado text,
  p_detalles jsonb DEFAULT NULL,
  p_venta jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_venta record;
  v_is_priv boolean;
  v_valid_transition boolean := false;
  v_subtotal numeric;
  v_descuento numeric;
  v_total numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  v_is_priv := public.has_role(v_user, 'admin'::app_role)
            OR public.has_role(v_user, 'encargado'::app_role)
            OR public.has_role(v_user, 'administracion'::app_role);

  SET LOCAL lock_timeout = '5s';
  PERFORM pg_advisory_xact_lock(hashtext('pos_actualizar_pedido:' || p_venta_id::text));

  SELECT * INTO v_venta FROM public.ventas WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF NOT v_is_priv AND v_venta.usuario_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'No tenés permiso para modificar este pedido';
  END IF;

  IF v_venta.anulada THEN
    RAISE EXCEPTION 'El pedido está anulado';
  END IF;

  IF v_venta.estado = 'confirmada' THEN
    RAISE EXCEPTION 'La venta ya fue confirmada, no se puede cambiar el estado del borrador';
  END IF;

  -- transiciones válidas
  IF (v_venta.estado = 'pedido' AND p_nuevo_estado = 'en_preparacion')
     OR (v_venta.estado = 'en_preparacion' AND p_nuevo_estado = 'preparado')
     OR (v_venta.estado = 'en_preparacion' AND p_nuevo_estado = 'pedido')
     OR (v_venta.estado = 'preparado' AND p_nuevo_estado = 'en_preparacion')
     OR (v_venta.estado = 'preparado' AND p_nuevo_estado = 'pedido')
  THEN
    v_valid_transition := true;
  END IF;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Transición no válida: % → %', v_venta.estado, p_nuevo_estado;
  END IF;

  -- reemplazar detalles si vienen
  IF p_detalles IS NOT NULL AND jsonb_typeof(p_detalles) = 'array' THEN
    DELETE FROM public.venta_detalles WHERE venta_id = p_venta_id;

    IF jsonb_array_length(p_detalles) > 0 THEN
      INSERT INTO public.venta_detalles (
        venta_id, producto_id, cantidad, precio_unitario,
        descuento, descuento_porcentaje, subtotal,
        producto_temporal_nombre, producto_temporal_precio
      )
      SELECT
        p_venta_id,
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

    SELECT
      COALESCE(SUM(cantidad * precio_unitario), 0),
      COALESCE(SUM(COALESCE(descuento, 0)), 0),
      COALESCE(SUM(subtotal), 0)
    INTO v_subtotal, v_descuento, v_total
    FROM public.venta_detalles
    WHERE venta_id = p_venta_id;
  END IF;

  -- actualizar cabecera
  UPDATE public.ventas
     SET estado = p_nuevo_estado,
         cliente_id = COALESCE(NULLIF(p_venta->>'cliente_id','')::uuid, cliente_id),
         empleado_id = CASE
           WHEN p_venta ? 'empleado_id' THEN NULLIF(p_venta->>'empleado_id','')::uuid
           ELSE empleado_id
         END,
         subtotal = COALESCE(v_subtotal, subtotal),
         descuento = COALESCE(v_descuento, descuento),
         total = COALESCE(v_total, total),
         preparado_at = CASE WHEN p_nuevo_estado = 'preparado' THEN now() ELSE preparado_at END,
         preparado_por = CASE WHEN p_nuevo_estado = 'preparado' THEN v_user ELSE preparado_por END
   WHERE id = p_venta_id;

  RETURN jsonb_build_object(
    'id', p_venta_id,
    'estado_anterior', v_venta.estado,
    'estado_nuevo', p_nuevo_estado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_actualizar_pedido_estado(uuid, text, jsonb, jsonb) TO authenticated;
