-- Paso 1: Eliminar primero la tabla hoja_ruta con CASCADE (elimina políticas dependientes)
DROP TABLE IF EXISTS public.hoja_ruta CASCADE;

-- Paso 2: Eliminar tabla usuarios con CASCADE
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- Paso 3: Ahora podemos eliminar la función obsoleta
DROP FUNCTION IF EXISTS public.get_usuario_id() CASCADE;

-- Paso 4: Crear nueva función get_empleado_id()
CREATE OR REPLACE FUNCTION public.get_empleado_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT id FROM public.empleados 
    WHERE user_id = auth.uid() 
    LIMIT 1
  );
END;
$$;

-- Paso 5: Actualizar is_route_owner() para usar hojas_ruta y empleados
CREATE OR REPLACE FUNCTION public.is_route_owner(route_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    JOIN public.empleados e ON hr.chofer_id = e.id
    WHERE hr.id = route_id 
    AND e.user_id = auth.uid()
  );
END;
$$;

-- Paso 6: Actualizar is_stop_owner() para usar hojas_ruta y empleados
CREATE OR REPLACE FUNCTION public.is_stop_owner(stop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hoja_ruta_paradas p
    JOIN public.hojas_ruta hr ON p.hoja_ruta_id = hr.id
    JOIN public.empleados e ON hr.chofer_id = e.id
    WHERE p.id = stop_id 
    AND e.user_id = auth.uid()
  );
END;
$$;

-- Paso 7: Actualizar políticas RLS de hoja_ruta_paradas para usar hojas_ruta
DROP POLICY IF EXISTS "Choferes actualizan paradas" ON public.hoja_ruta_paradas;
DROP POLICY IF EXISTS "Choferes ven paradas de sus rutas" ON public.hoja_ruta_paradas;

CREATE POLICY "Choferes actualizan paradas" ON public.hoja_ruta_paradas
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    JOIN public.empleados e ON hr.chofer_id = e.id
    WHERE hr.id = hoja_ruta_paradas.hoja_ruta_id 
    AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Choferes ven paradas de sus rutas" ON public.hoja_ruta_paradas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    JOIN public.empleados e ON hr.chofer_id = e.id
    WHERE hr.id = hoja_ruta_paradas.hoja_ruta_id 
    AND e.user_id = auth.uid()
  )
);