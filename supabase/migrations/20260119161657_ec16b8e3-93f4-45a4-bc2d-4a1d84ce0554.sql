-- Add payment tracking fields to empleado_liquidaciones
ALTER TABLE public.empleado_liquidaciones 
  ADD COLUMN forma_pago_id UUID REFERENCES formas_pago(id),
  ADD COLUMN caja_id UUID REFERENCES cajas(id);