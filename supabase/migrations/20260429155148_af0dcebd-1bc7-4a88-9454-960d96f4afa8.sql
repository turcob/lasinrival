CREATE TABLE IF NOT EXISTS public.hoja_ruta_refacturaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_ruta_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad_anterior numeric NOT NULL,
  cantidad_nueva numeric NOT NULL,
  cantidad_descontada numeric NOT NULL,
  pedidos_afectados jsonb NOT NULL DEFAULT '[]'::jsonb,
  usuario_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.hoja_ruta_refacturaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with logistica permission can view refacturaciones" ON public.hoja_ruta_refacturaciones;
CREATE POLICY "Users with logistica permission can view refacturaciones"
ON public.hoja_ruta_refacturaciones
FOR SELECT
TO authenticated
USING (public.has_permission(auth.uid(), 'logistica'::text, 'ver'::public.app_permission));

DROP POLICY IF EXISTS "Users with logistica permission can insert refacturaciones" ON public.hoja_ruta_refacturaciones;
CREATE POLICY "Users with logistica permission can insert refacturaciones"
ON public.hoja_ruta_refacturaciones
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = usuario_id
  AND public.has_permission(auth.uid(), 'logistica'::text, 'editar'::public.app_permission)
);

CREATE INDEX IF NOT EXISTS idx_hoja_ruta_refacturaciones_hoja ON public.hoja_ruta_refacturaciones(hoja_ruta_id);
CREATE INDEX IF NOT EXISTS idx_hoja_ruta_refacturaciones_producto ON public.hoja_ruta_refacturaciones(producto_id);

CREATE OR REPLACE FUNCTION public.refacturar_hoja_ruta_producto(
  p_hoja_ruta_id uuid,
  p_producto_id uuid,
  p_nueva_cantidad numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_total_actual numeric;
  v_restante numeric;
  v_quitar numeric;
  v_nueva_linea numeric;
  v_nuevo_subtotal numeric;
  v_nuevo_total_pedido numeric;
  v_pedidos_afectados jsonb := '[]'::jsonb;
  v_refacturacion_id uuid;
  r record;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT public.has_permission(v_usuario_id, 'logistica'::text, 'editar'::public.app_permission) THEN
    RAISE EXCEPTION 'No tenés permiso para refacturar hojas de ruta';
  END IF;

  IF p_nueva_cantidad < 0 THEN
    RAISE EXCEPTION 'La nueva cantidad no puede ser negativa';
  END IF;

  SELECT COALESCE(SUM(pd.cantidad_pedida), 0)
  INTO v_total_actual
  FROM public.hoja_ruta_paradas hrp
  JOIN public.pedido_detalles pd ON pd.pedido_id = hrp.pedido_id
  WHERE hrp.hoja_ruta_id = p_hoja_ruta_id
    AND pd.producto_id = p_producto_id;

  IF v_total_actual <= 0 THEN
    RAISE EXCEPTION 'El producto no está incluido en esta hoja de ruta';
  END IF;

  IF p_nueva_cantidad >= v_total_actual THEN
    RAISE EXCEPTION 'La nueva cantidad debe ser menor que la cantidad actual';
  END IF;

  v_restante := v_total_actual - p_nueva_cantidad;

  FOR r IN
    SELECT
      pd.id AS detalle_id,
      pd.pedido_id,
      pd.cantidad_pedida,
      COALESCE(pd.precio_unitario, 0) AS precio_unitario,
      COALESCE(pd.descuento_porcentaje, 0) AS descuento_porcentaje,
      p.numero_pedido,
      p.estado,
      p.cliente_id,
      pr.descripcion AS producto_descripcion
    FROM public.hoja_ruta_paradas hrp
    JOIN public.pedido_detalles pd ON pd.pedido_id = hrp.pedido_id
    JOIN public.pedidos p ON p.id = pd.pedido_id
    LEFT JOIN public.productos pr ON pr.id = pd.producto_id
    WHERE hrp.hoja_ruta_id = p_hoja_ruta_id
      AND pd.producto_id = p_producto_id
      AND pd.cantidad_pedida > 0
    ORDER BY pd.cantidad_pedida ASC, random()
  LOOP
    EXIT WHEN v_restante <= 0;

    v_quitar := LEAST(v_restante, r.cantidad_pedida);
    v_nueva_linea := r.cantidad_pedida - v_quitar;
    v_nuevo_subtotal := v_nueva_linea * r.precio_unitario * (1 - (r.descuento_porcentaje / 100));

    UPDATE public.pedido_detalles
    SET
      cantidad_pedida = v_nueva_linea,
      cantidad_entregada = v_nueva_linea,
      subtotal = v_nuevo_subtotal
    WHERE id = r.detalle_id;

    SELECT COALESCE(SUM(subtotal), 0)
    INTO v_nuevo_total_pedido
    FROM public.pedido_detalles
    WHERE pedido_id = r.pedido_id;

    UPDATE public.pedidos
    SET subtotal = v_nuevo_total_pedido,
        total = v_nuevo_total_pedido,
        updated_at = now()
    WHERE id = r.pedido_id;

    UPDATE public.cliente_movimientos
    SET monto = v_nuevo_total_pedido
    WHERE cliente_id = r.cliente_id
      AND tipo = 'compra'
      AND COALESCE(origen, 'sistema') <> 'historico'
      AND concepto = ('Remito Pedido #' || lpad(r.numero_pedido::text, 6, '0'));

    INSERT INTO public.pedido_historial (
      pedido_id,
      estado_anterior,
      estado_nuevo,
      usuario_id,
      observaciones
    ) VALUES (
      r.pedido_id,
      r.estado,
      r.estado,
      v_usuario_id,
      'Refacturación hoja de ruta: producto ' || COALESCE(r.producto_descripcion, p_producto_id::text) ||
      ' ajustado de ' || r.cantidad_pedida::text || ' a ' || v_nueva_linea::text ||
      '. Remito anterior anulado operativamente y regenerado con nuevos valores.'
    );

    v_pedidos_afectados := v_pedidos_afectados || jsonb_build_array(jsonb_build_object(
      'pedido_id', r.pedido_id,
      'numero_pedido', r.numero_pedido,
      'detalle_id', r.detalle_id,
      'cantidad_anterior', r.cantidad_pedida,
      'cantidad_nueva', v_nueva_linea,
      'cantidad_descontada', v_quitar,
      'total_nuevo', v_nuevo_total_pedido
    ));

    v_restante := v_restante - v_quitar;
  END LOOP;

  IF v_restante > 0 THEN
    RAISE EXCEPTION 'No se pudo completar la refacturación';
  END IF;

  INSERT INTO public.hoja_ruta_refacturaciones (
    hoja_ruta_id,
    producto_id,
    cantidad_anterior,
    cantidad_nueva,
    cantidad_descontada,
    pedidos_afectados,
    usuario_id
  ) VALUES (
    p_hoja_ruta_id,
    p_producto_id,
    v_total_actual,
    p_nueva_cantidad,
    v_total_actual - p_nueva_cantidad,
    v_pedidos_afectados,
    v_usuario_id
  )
  RETURNING id INTO v_refacturacion_id;

  RETURN jsonb_build_object(
    'refacturacion_id', v_refacturacion_id,
    'cantidad_anterior', v_total_actual,
    'cantidad_nueva', p_nueva_cantidad,
    'cantidad_descontada', v_total_actual - p_nueva_cantidad,
    'pedidos_afectados', v_pedidos_afectados
  );
END;
$$;