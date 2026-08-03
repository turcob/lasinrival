DROP INDEX IF EXISTS public.lista_precio_excepciones_lista_producto_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS lista_precio_excepciones_lista_producto_uidx
  ON public.lista_precio_excepciones (lista_precio_id, producto_id);