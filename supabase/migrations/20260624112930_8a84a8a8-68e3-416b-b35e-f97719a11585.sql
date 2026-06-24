
-- Hacer numero_comprobante nullable para soportar pedidos sin numero
ALTER TABLE public.ventas ALTER COLUMN numero_comprobante DROP NOT NULL;

-- Reescribir funcion: asignar numero solo cuando estado != 'pedido' y aun es NULL
CREATE OR REPLACE FUNCTION public.ventas_asignar_numero_comprobante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_numero integer;
BEGIN
  IF NEW.numero_comprobante IS NULL AND COALESCE(NEW.estado, 'confirmada') <> 'pedido' THEN
    UPDATE public.ventas_numero_counter
       SET ultimo_numero = ultimo_numero + 1,
           updated_at = now()
     WHERE id = 1
    RETURNING ultimo_numero INTO v_numero;
    NEW.numero_comprobante := v_numero;
  END IF;
  RETURN NEW;
END;
$function$;

-- Asegurar que el trigger corra tambien en UPDATE (transicion pedido -> confirmada)
DROP TRIGGER IF EXISTS trg_ventas_asignar_numero ON public.ventas;
CREATE TRIGGER trg_ventas_asignar_numero
BEFORE INSERT OR UPDATE ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.ventas_asignar_numero_comprobante();

-- Actualizar la RPC para no consumir numero cuando se crea como 'pedido'
CREATE OR REPLACE FUNCTION public.crear_venta_completa(p_venta jsonb, p_detalles jsonb, p_pagos jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_numero integer;
  v_venta_id uuid;
  v_estado text := COALESCE(p_venta->>'estado', 'confirmada');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Solo reservar numero si la venta nace confirmada
  IF v_estado <> 'pedido' THEN
    UPDATE public.ventas_numero_counter
       SET ultimo_numero = ultimo_numero + 1,
           updated_at = now()
     WHERE id = 1
    RETURNING ultimo_numero INTO v_numero;
  ELSE
    v_numero := NULL;
  END IF;

  INSERT INTO public.ventas (
    numero_comprobante, usuario_id, cliente_id, empleado_id, caja_id,
    subtotal, descuento, total, estado
  ) VALUES (
    v_numero,
    COALESCE(NULLIF(p_venta->>'usuario_id','')::uuid, auth.uid()),
    NULLIF(p_venta->>'cliente_id','')::uuid,
    NULLIF(p_venta->>'empleado_id','')::uuid,
    NULLIF(p_venta->>'caja_id','')::uuid,
    COALESCE((p_venta->>'subtotal')::numeric, 0),
    COALESCE((p_venta->>'descuento')::numeric, 0),
    COALESCE((p_venta->>'total')::numeric, 0),
    v_estado
  )
  RETURNING id, numero_comprobante INTO v_venta_id, v_numero;

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
      efectivo_entregado, vuelto
    )
    SELECT
      v_venta_id,
      (p->>'forma_pago_id')::uuid,
      (p->>'monto')::numeric,
      NULLIF(p->>'tarjeta_id','')::uuid,
      NULLIF(p->>'cuotas','')::integer,
      NULLIF(p->>'coeficiente','')::numeric,
      NULLIF(p->>'efectivo_entregado','')::numeric,
      NULLIF(p->>'vuelto','')::numeric
    FROM jsonb_array_elements(p_pagos) p;
  END IF;

  RETURN jsonb_build_object(
    'id', v_venta_id,
    'numero_comprobante', v_numero
  );
END;
$function$;

-- Limpiar numero reservado en pedidos existentes (devolver al pool no es trivial,
-- pero al menos liberamos visualmente la columna para que no aparenten saltos)
-- NO se reciclan los numeros ya emitidos a pedidos antiguos para evitar duplicados.
