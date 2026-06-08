ALTER TABLE public.empleados ADD COLUMN IF NOT EXISTS tipo_liquidacion text NOT NULL DEFAULT 'mensual';

ALTER TABLE public.empleados DROP CONSTRAINT IF EXISTS empleados_tipo_liquidacion_check;
ALTER TABLE public.empleados ADD CONSTRAINT empleados_tipo_liquidacion_check CHECK (tipo_liquidacion IN ('mensual', 'quincenal', 'semanal'));