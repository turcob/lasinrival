
-- Reemplazar policies de hoja_ruta_paradas para permitir responsable además del chofer
DROP POLICY IF EXISTS "Choferes actualizan paradas" ON public.hoja_ruta_paradas;
DROP POLICY IF EXISTS "Choferes ven paradas de sus rutas" ON public.hoja_ruta_paradas;

CREATE POLICY "Encargados ven paradas de sus rutas"
ON public.hoja_ruta_paradas FOR SELECT
USING (
  public.is_stop_owner(id)
  AND EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    WHERE hr.id = hoja_ruta_paradas.hoja_ruta_id
      AND hr.estado IN ('en_ruta','completada','rendida','carga_confirmada','en_carga')
  )
);

CREATE POLICY "Encargados actualizan paradas"
ON public.hoja_ruta_paradas FOR UPDATE
USING (
  public.is_stop_owner(id)
  AND EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    WHERE hr.id = hoja_ruta_paradas.hoja_ruta_id
      AND hr.estado = 'en_ruta'
  )
)
WITH CHECK (
  public.is_stop_owner(id)
  AND EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    WHERE hr.id = hoja_ruta_paradas.hoja_ruta_id
      AND hr.estado = 'en_ruta'
  )
);
