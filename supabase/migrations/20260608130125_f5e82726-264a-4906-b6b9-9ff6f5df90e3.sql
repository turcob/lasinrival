
ALTER TABLE public.empleado_liquidaciones
  ADD COLUMN IF NOT EXISTS fecha_desde DATE,
  ADD COLUMN IF NOT EXISTS fecha_hasta DATE;

-- Backfill from mes/anio for existing rows
UPDATE public.empleado_liquidaciones
SET fecha_desde = make_date(anio, mes, 1),
    fecha_hasta = (make_date(anio, mes, 1) + INTERVAL '1 month - 1 day')::date
WHERE fecha_desde IS NULL OR fecha_hasta IS NULL;

-- Drop unique (empleado_id, mes, anio) — multiple periods now allowed (quincenal/semanal)
ALTER TABLE public.empleado_liquidaciones
  DROP CONSTRAINT IF EXISTS empleado_liquidaciones_empleado_id_mes_anio_key;

CREATE INDEX IF NOT EXISTS idx_emp_liq_empleado_rango
  ON public.empleado_liquidaciones (empleado_id, fecha_desde, fecha_hasta);
