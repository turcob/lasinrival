-- 1) Cliente: flag para permitir / bloquear facturación a cuenta corriente
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS permite_cuenta_corriente boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.clientes.permite_cuenta_corriente IS
  'Si es false, no se puede facturar a este cliente en cuenta corriente. Solo permite venta con pago directo.';

-- 2) Cobros de hoja de ruta: marca de "subsanado administrativo"
-- cuando el fletero cambia el medio de pago a transferencia y la transferencia
-- no llegó a tiempo, Administración puede subsanarlo desde aquí.
ALTER TABLE public.hoja_ruta_cobros
  ADD COLUMN IF NOT EXISTS subsanado_administrativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subsanado_observaciones text,
  ADD COLUMN IF NOT EXISTS subsanado_por uuid,
  ADD COLUMN IF NOT EXISTS subsanado_at timestamptz,
  ADD COLUMN IF NOT EXISTS medio_pago_original_id uuid;

COMMENT ON COLUMN public.hoja_ruta_cobros.subsanado_administrativo IS
  'Marca administrativa cuando el cobro se reclasifica fuera del flujo normal del fletero (ej: efectivo cambiado a transferencia que no llegó a tiempo).';
COMMENT ON COLUMN public.hoja_ruta_cobros.medio_pago_original_id IS
  'Forma de pago original declarada por el fletero antes de la reclasificación.';