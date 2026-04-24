-- Actualizar is_route_owner: si hay responsable, gana el responsable; si no, el chofer
CREATE OR REPLACE FUNCTION public.is_route_owner(route_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    LEFT JOIN public.empleados e_resp ON hr.responsable_id = e_resp.id
    LEFT JOIN public.empleados e_chof ON hr.chofer_id = e_chof.id
    WHERE hr.id = route_id
      AND (
        (hr.responsable_id IS NOT NULL AND e_resp.user_id = auth.uid())
        OR
        (hr.responsable_id IS NULL AND e_chof.user_id = auth.uid())
      )
  );
END;
$function$;

-- Actualizar is_stop_owner: misma lógica aplicada a paradas
CREATE OR REPLACE FUNCTION public.is_stop_owner(stop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hoja_ruta_paradas p
    JOIN public.hojas_ruta hr ON p.hoja_ruta_id = hr.id
    LEFT JOIN public.empleados e_resp ON hr.responsable_id = e_resp.id
    LEFT JOIN public.empleados e_chof ON hr.chofer_id = e_chof.id
    WHERE p.id = stop_id
      AND (
        (hr.responsable_id IS NOT NULL AND e_resp.user_id = auth.uid())
        OR
        (hr.responsable_id IS NULL AND e_chof.user_id = auth.uid())
      )
  );
END;
$function$;