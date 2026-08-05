ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS unidades_por_empaque numeric NULL;