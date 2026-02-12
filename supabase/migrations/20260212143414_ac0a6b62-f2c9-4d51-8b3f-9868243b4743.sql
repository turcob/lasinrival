
-- Add terminal number to clientes
ALTER TABLE public.clientes ADD COLUMN numero_terminal_clover text DEFAULT NULL;

-- Create clover_pagos table
CREATE TABLE public.clover_pagos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_pago timestamp with time zone NOT NULL,
  pago_id_clover text NOT NULL,
  factura_numero text,
  codigo_autorizacion text,
  numero_transaccion text,
  medio_pago text,
  marca_tarjeta text,
  numero_tarjeta text,
  moneda text DEFAULT 'ARS',
  importe numeric NOT NULL DEFAULT 0,
  importe_impuestos numeric DEFAULT 0,
  importe_propinas numeric DEFAULT 0,
  nombre_cliente_clover text,
  numero_cuotas integer,
  terminal_id text,
  numero_lote text,
  numero_recibo text,
  resultado text,
  dispositivo text,
  importe_devolucion numeric DEFAULT 0,
  -- Asociación con el sistema
  cliente_id uuid REFERENCES public.clientes(id),
  movimiento_id uuid REFERENCES public.cliente_movimientos(id),
  asociado boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  usuario_importacion_id uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.clover_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view clover_pagos"
  ON public.clover_pagos FOR SELECT
  USING (true);

CREATE POLICY "Users with permission can insert clover_pagos"
  ON public.clover_pagos FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'clientes'::text, 'crear'::app_permission));

CREATE POLICY "Users with permission can update clover_pagos"
  ON public.clover_pagos FOR UPDATE
  USING (has_permission(auth.uid(), 'clientes'::text, 'editar'::app_permission));

CREATE POLICY "Users with permission can delete clover_pagos"
  ON public.clover_pagos FOR DELETE
  USING (has_permission(auth.uid(), 'clientes'::text, 'eliminar'::app_permission));
