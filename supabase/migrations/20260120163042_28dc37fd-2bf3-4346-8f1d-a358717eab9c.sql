-- Agregar columnas de fecha inicio y fin a excepciones de productos
ALTER TABLE public.lista_precio_excepciones 
ADD COLUMN fecha_inicio DATE DEFAULT NULL,
ADD COLUMN fecha_fin DATE DEFAULT NULL;

-- Comentarios para documentar
COMMENT ON COLUMN public.lista_precio_excepciones.fecha_inicio IS 'Fecha desde la cual aplica la excepción (null = sin límite de inicio)';
COMMENT ON COLUMN public.lista_precio_excepciones.fecha_fin IS 'Fecha hasta la cual aplica la excepción (null = sin límite de fin)';