ALTER TABLE public.arqueo_otros_medios
  ADD COLUMN categoria text
    CHECK (categoria IN ('efectivo','debito','credito','transferencia','cheque','otro')),
  ADD COLUMN forma_pago_id uuid NULL REFERENCES public.formas_pago(id),
  ADD COLUMN esperado numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.arqueo_otros_medios
  ADD COLUMN diferencia numeric GENERATED ALWAYS AS (monto - esperado) STORED;

UPDATE public.arqueo_otros_medios
   SET categoria = 'transferencia'
 WHERE tipo = 'transferencias' AND categoria IS NULL;

UPDATE public.arqueo_otros_medios
   SET categoria = 'otro'
 WHERE tipo = 'posnet' AND categoria IS NULL;