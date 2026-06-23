
ALTER TABLE public.transferencias
  ALTER COLUMN cliente_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS foto_comprobante_path text,
  ADD COLUMN IF NOT EXISTS foto_comprobante_nombre text;
