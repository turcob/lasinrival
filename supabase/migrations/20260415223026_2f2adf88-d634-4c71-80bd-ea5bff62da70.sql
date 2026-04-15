
CREATE POLICY "Authenticated users can insert cobros"
ON public.hoja_ruta_cobros
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);
