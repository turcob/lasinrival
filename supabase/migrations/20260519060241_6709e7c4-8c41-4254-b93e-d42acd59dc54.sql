-- Permitir que el encargado/chofer asignado avance su propia hoja de ruta
-- sin necesitar permisos administrativos del módulo logística.
CREATE POLICY "Encargados pueden avanzar sus hojas de ruta"
ON public.hojas_ruta
FOR UPDATE
TO authenticated
USING (
  public.is_route_owner(id)
  AND estado IN ('carga_confirmada', 'en_ruta', 'completada')
)
WITH CHECK (
  public.is_route_owner(id)
  AND estado IN ('en_ruta', 'completada')
);