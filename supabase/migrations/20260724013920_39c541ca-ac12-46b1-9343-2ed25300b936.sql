
-- 1. Feature flag POS mayorista
ALTER TABLE public.configuracion_comercio
  ADD COLUMN IF NOT EXISTS pos_flujo_mayorista_activo boolean NOT NULL DEFAULT false;

-- 2. Nueva columna ventas.vendedor_id (Opción B)
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS vendedor_id uuid;

CREATE INDEX IF NOT EXISTS ventas_vendedor_id_idx ON public.ventas(vendedor_id);

-- 3. Nuevo valor de enum pedido_estado
ALTER TYPE public.pedido_estado ADD VALUE IF NOT EXISTS 'facturado';
