ALTER TABLE public.configuracion_comercio
  ADD COLUMN formato_codigo_balanza text NOT NULL DEFAULT 'plu5_peso6';

ALTER TABLE public.configuracion_comercio
  ADD CONSTRAINT configuracion_comercio_formato_balanza_check
  CHECK (formato_codigo_balanza IN ('plu5_peso6', 'plu6_peso5'));

COMMENT ON COLUMN public.configuracion_comercio.formato_codigo_balanza IS
  'Formato del codigo EAN-13 de balanza. plu5_peso6 = 2+PLU(5)+peso_gramos(6)+check. plu6_peso5 = 2+PLU(6)+peso_gramos(5)+check. Global; asume todas las balanzas configuradas igual.';