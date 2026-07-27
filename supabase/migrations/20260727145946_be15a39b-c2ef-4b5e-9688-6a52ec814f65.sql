ALTER TABLE public.formas_pago
  ADD COLUMN categoria text NOT NULL DEFAULT 'otro';

ALTER TABLE public.formas_pago
  ADD CONSTRAINT formas_pago_categoria_check
  CHECK (categoria IN ('efectivo','debito','credito','transferencia','cheque','otro'));

UPDATE public.formas_pago
SET categoria = CASE
  WHEN lower(nombre) ~ 'efectivo'      THEN 'efectivo'
  WHEN lower(nombre) ~ 'transferencia' THEN 'transferencia'
  WHEN lower(nombre) ~ 'cheque'        THEN 'cheque'
  WHEN lower(nombre) ~ 'd[eé]bito'     THEN 'debito'
  WHEN lower(nombre) ~ 'cr[eé]dito'    THEN 'credito'
  ELSE 'otro'
END;