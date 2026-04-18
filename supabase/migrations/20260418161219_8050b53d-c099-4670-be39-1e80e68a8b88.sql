-- Permitir a los choferes crear rendiciones de sus propias hojas de ruta
CREATE POLICY "Choferes pueden crear rendiciones de sus rutas"
ON public.hoja_ruta_rendiciones
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = usuario_id 
  AND public.is_route_owner(hoja_ruta_id)
);

-- Permitir a los choferes ver las rendiciones de sus rutas
CREATE POLICY "Choferes pueden ver rendiciones de sus rutas"
ON public.hoja_ruta_rendiciones
FOR SELECT
TO authenticated
USING (public.is_route_owner(hoja_ruta_id));

-- Permitir a los choferes actualizar rendiciones pendientes de sus rutas
CREATE POLICY "Choferes pueden actualizar rendiciones pendientes de sus rutas"
ON public.hoja_ruta_rendiciones
FOR UPDATE
TO authenticated
USING (
  public.is_route_owner(hoja_ruta_id) 
  AND estado = 'pendiente'
);