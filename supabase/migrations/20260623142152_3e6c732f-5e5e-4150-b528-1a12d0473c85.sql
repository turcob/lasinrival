-- Add pending validation state and venta link for cheques originating from POS
ALTER TYPE public.cheque_estado ADD VALUE IF NOT EXISTS 'pendiente_validacion';

ALTER TABLE public.cheques
  ADD COLUMN IF NOT EXISTS venta_id uuid REFERENCES public.ventas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cheques_venta_id ON public.cheques(venta_id);
CREATE INDEX IF NOT EXISTS idx_cheques_estado ON public.cheques(estado);