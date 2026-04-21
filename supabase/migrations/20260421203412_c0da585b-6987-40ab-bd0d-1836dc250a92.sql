
-- Permitir que choferes (repartidores) registren rechazos en sus propias paradas
CREATE POLICY "Choferes pueden insertar devoluciones de sus paradas"
ON public.hoja_ruta_devoluciones
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = usuario_id
  AND public.is_stop_owner(parada_id)
);

-- Permitir que choferes vean las devoluciones de sus paradas
CREATE POLICY "Choferes pueden ver devoluciones de sus paradas"
ON public.hoja_ruta_devoluciones
FOR SELECT
TO authenticated
USING (public.is_stop_owner(parada_id));

-- Permitir que choferes inserten NC pendientes generadas desde sus rechazos de logística
CREATE POLICY "Choferes pueden crear NC pendientes desde rechazo logistica"
ON public.notas_credito_pendientes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = usuario_creador_id
  AND origen = 'rechazo_logistica'
  AND parada_id IS NOT NULL
  AND public.is_stop_owner(parada_id)
);
