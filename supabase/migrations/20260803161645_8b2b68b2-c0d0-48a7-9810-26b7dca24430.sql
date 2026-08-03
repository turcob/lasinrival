ALTER TABLE public.lista_precio_excepciones
  ADD COLUMN IF NOT EXISTS precio_fijo numeric NULL;

ALTER TABLE public.lista_precio_excepciones
  ALTER COLUMN porcentaje DROP NOT NULL;

ALTER TABLE public.lista_precio_excepciones
  DROP CONSTRAINT IF EXISTS lista_precio_excepciones_valor_check;

ALTER TABLE public.lista_precio_excepciones
  ADD CONSTRAINT lista_precio_excepciones_valor_check
  CHECK (porcentaje IS NOT NULL OR precio_fijo IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS lista_precio_excepciones_lista_producto_uidx
  ON public.lista_precio_excepciones (lista_precio_id, producto_id)
  WHERE lista_precio_id IS NOT NULL;

-- (sin índice único global: ya existen excepciones globales duplicadas históricas)