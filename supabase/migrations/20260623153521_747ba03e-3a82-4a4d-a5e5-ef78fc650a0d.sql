
CREATE OR REPLACE FUNCTION public.ventas_asignar_numero_comprobante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero integer;
BEGIN
  IF NEW.numero_comprobante IS NULL THEN
    UPDATE public.ventas_numero_counter
       SET ultimo_numero = ultimo_numero + 1,
           updated_at = now()
     WHERE id = 1
    RETURNING ultimo_numero INTO v_numero;
    NEW.numero_comprobante := v_numero;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_asignar_numero ON public.ventas;
CREATE TRIGGER trg_ventas_asignar_numero
BEFORE INSERT ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.ventas_asignar_numero_comprobante();
