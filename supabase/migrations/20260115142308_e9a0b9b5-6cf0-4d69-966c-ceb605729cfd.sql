-- Agregar campos para rastrear quién desactivó el producto y cuándo
ALTER TABLE productos ADD COLUMN IF NOT EXISTS desactivado_por uuid REFERENCES auth.users(id);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS fecha_desactivacion timestamp with time zone;