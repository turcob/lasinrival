-- Add forma_pago_id column to cliente_movimientos
ALTER TABLE public.cliente_movimientos 
ADD COLUMN forma_pago_id UUID REFERENCES public.formas_pago(id);