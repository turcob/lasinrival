-- Permitir a admins actualizar movimientos de caja
CREATE POLICY "Admins can update movimientos_caja"
ON public.movimientos_caja
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));