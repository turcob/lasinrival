ALTER TABLE public.hojas_ruta DROP CONSTRAINT IF EXISTS hojas_ruta_estado_check;

ALTER TABLE public.hojas_ruta ADD CONSTRAINT hojas_ruta_estado_check
  CHECK (estado = ANY (ARRAY[
    'planificada'::text,
    'en_carga'::text,
    'carga_confirmada'::text,
    'en_ruta'::text,
    'completada'::text,
    'cancelada'::text
  ]));