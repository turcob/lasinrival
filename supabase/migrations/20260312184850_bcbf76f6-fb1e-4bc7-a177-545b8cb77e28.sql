
-- Add blocking config to configuracion_comercio
ALTER TABLE public.configuracion_comercio 
  ADD COLUMN facturas_adeudadas_bloqueo integer NOT NULL DEFAULT 3,
  ADD COLUMN bloqueo_automatico_activo boolean NOT NULL DEFAULT true;

-- Add per-client override and blocked status to clientes
ALTER TABLE public.clientes
  ADD COLUMN facturas_adeudadas_bloqueo_override integer,
  ADD COLUMN bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN motivo_bloqueo text;

-- Create a view that counts unpaid invoices per client
CREATE OR REPLACE VIEW public.cliente_facturas_adeudadas AS
SELECT 
  cliente_id,
  COUNT(*) as cantidad_facturas_adeudadas
FROM public.cliente_movimientos
WHERE tipo = 'compra' 
  AND estado_imputacion IS DISTINCT FROM 'imputado'
GROUP BY cliente_id;
