-- Permitir lectura pública de la configuración del comercio para el login
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver configuración" ON public.configuracion_comercio;

CREATE POLICY "Todos pueden ver configuración" 
ON public.configuracion_comercio 
FOR SELECT 
USING (true);