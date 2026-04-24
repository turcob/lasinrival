-- Ampliar motivos en hoja_ruta_devoluciones
ALTER TABLE public.hoja_ruta_devoluciones
  DROP CONSTRAINT IF EXISTS hoja_ruta_devoluciones_motivo_check;

ALTER TABLE public.hoja_ruta_devoluciones
  ADD CONSTRAINT hoja_ruta_devoluciones_motivo_check
  CHECK (motivo = ANY (ARRAY[
    'rechazo_cliente'::text,
    'producto_vencido'::text,
    'producto_roto'::text,
    'producto_faltante'::text,
    'producto_sobrante'::text,
    'cambio'::text,
    'error_pedido'::text,
    'faltante'::text,
    'sobrante'::text,
    'dañado'::text,
    'danado'::text,
    'mal_estado'::text,
    'vencido'::text,
    'otro'::text
  ]));

-- Aplicar mismos motivos a notas_credito_pendientes si tuviera check (no lo tiene actualmente, pero por seguridad)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notas_credito_pendientes'::regclass
      AND conname = 'notas_credito_pendientes_motivo_check'
  ) THEN
    ALTER TABLE public.notas_credito_pendientes
      DROP CONSTRAINT notas_credito_pendientes_motivo_check;
  END IF;
END $$;