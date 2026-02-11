ALTER TABLE public.cliente_movimientos 
  ADD COLUMN IF NOT EXISTS numero_comprobante text,
  ADD COLUMN IF NOT EXISTS codigo_deposito text,
  ADD COLUMN IF NOT EXISTS nombre_vendedor text;