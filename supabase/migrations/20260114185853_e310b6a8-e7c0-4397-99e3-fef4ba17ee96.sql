-- Agregar precio_costo a productos
ALTER TABLE public.productos 
ADD COLUMN precio_costo numeric NOT NULL DEFAULT 0;

-- Agregar porcentaje a listas_precios (solo positivo, validado en la app)
ALTER TABLE public.listas_precios 
ADD COLUMN porcentaje numeric NOT NULL DEFAULT 0;

-- Eliminar tabla precios_productos y sus políticas
DROP TABLE IF EXISTS public.precios_productos CASCADE;