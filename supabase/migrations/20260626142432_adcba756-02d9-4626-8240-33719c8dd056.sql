
ALTER TABLE public.comprobantes_afip
  ADD COLUMN IF NOT EXISTS resolucion_financiera text,
  ADD COLUMN IF NOT EXISTS caja_movimiento_id uuid REFERENCES public.movimientos_caja(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolucion_cliente_movimiento_id uuid REFERENCES public.cliente_movimientos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolucion_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolucion_por uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS comprobantes_afip_caja_mov_uniq
  ON public.comprobantes_afip(caja_movimiento_id) WHERE caja_movimiento_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS comprobantes_afip_cc_mov_uniq
  ON public.comprobantes_afip(resolucion_cliente_movimiento_id) WHERE resolucion_cliente_movimiento_id IS NOT NULL;
