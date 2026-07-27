DROP POLICY "Users can insert arqueo_otros_medios" ON public.arqueo_otros_medios;

CREATE POLICY "Dueño de caja puede insertar arqueo_otros_medios"
  ON public.arqueo_otros_medios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cajas c
      WHERE c.id = arqueo_otros_medios.caja_id
        AND c.usuario_id = auth.uid()
        AND COALESCE(c.arqueo_confirmado, false) = false
    )
  );