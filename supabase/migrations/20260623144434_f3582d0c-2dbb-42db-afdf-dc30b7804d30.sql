
-- 1) Counter table (single row)
CREATE TABLE IF NOT EXISTS public.ventas_numero_counter (
  id smallint PRIMARY KEY DEFAULT 1,
  ultimo_numero integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ventas_numero_counter_single CHECK (id = 1)
);

GRANT SELECT ON public.ventas_numero_counter TO authenticated;
GRANT ALL ON public.ventas_numero_counter TO service_role;

ALTER TABLE public.ventas_numero_counter ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read counter" ON public.ventas_numero_counter;
CREATE POLICY "Auth read counter"
  ON public.ventas_numero_counter FOR SELECT
  TO authenticated USING (true);

-- Seed with current max so no duplicates
INSERT INTO public.ventas_numero_counter (id, ultimo_numero)
VALUES (1, COALESCE((SELECT MAX(numero_comprobante) FROM public.ventas), 0))
ON CONFLICT (id) DO UPDATE
  SET ultimo_numero = GREATEST(public.ventas_numero_counter.ultimo_numero,
                               COALESCE((SELECT MAX(numero_comprobante) FROM public.ventas), 0));

-- 2) Drop the SERIAL default so direct inserts don't consume numbers
ALTER TABLE public.ventas ALTER COLUMN numero_comprobante DROP DEFAULT;

-- 3) Atomic RPC: assigns number + inserts venta + detalles + pagos
CREATE OR REPLACE FUNCTION public.crear_venta_completa(
  p_venta jsonb,
  p_detalles jsonb,
  p_pagos jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero integer;
  v_venta_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Lock counter and get next number atomically
  UPDATE public.ventas_numero_counter
     SET ultimo_numero = ultimo_numero + 1,
         updated_at = now()
   WHERE id = 1
  RETURNING ultimo_numero INTO v_numero;

  -- Insert venta
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
    COALESCE(p_venta->>'estado', 'confirmada')
  )
  RETURNING id INTO v_venta_id;

  -- Insert detalles
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

  -- Insert pagos
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
$$;

GRANT EXECUTE ON FUNCTION public.crear_venta_completa(jsonb, jsonb, jsonb) TO authenticated;
