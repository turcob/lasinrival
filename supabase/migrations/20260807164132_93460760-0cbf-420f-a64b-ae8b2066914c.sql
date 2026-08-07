ALTER TABLE public.productos
  ADD COLUMN plu_balanza integer;

ALTER TABLE public.productos
  ADD CONSTRAINT productos_plu_balanza_rango
  CHECK (plu_balanza IS NULL OR (plu_balanza > 0 AND plu_balanza <= 99999));

CREATE INDEX idx_productos_plu_balanza
  ON public.productos (plu_balanza)
  WHERE plu_balanza IS NOT NULL;

COMMENT ON COLUMN public.productos.plu_balanza IS
  'PLU de balanza Kretz (etiqueta EAN-13 peso variable, prefijo 2, formato 2-5-6). Nullable, no unico todavia (resolver duplicados antes de indice unico).';