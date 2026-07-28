
CREATE UNIQUE INDEX IF NOT EXISTS uq_arqueo_otros_medios_caja_cat
  ON public.arqueo_otros_medios (caja_id, categoria)
  WHERE categoria IS NOT NULL;
