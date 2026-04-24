CREATE OR REPLACE FUNCTION public.normalize_hoja_ruta_devolucion_motivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_motivo text;
BEGIN
  IF NEW.motivo IS NULL THEN
    RETURN NEW;
  END IF;

  v_motivo := lower(trim(translate(NEW.motivo, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')));

  NEW.motivo := CASE v_motivo
    WHEN 'rechazo_cliente' THEN 'rechazo_cliente'
    WHEN 'rechazo del cliente' THEN 'rechazo_cliente'
    WHEN 'producto_vencido' THEN 'producto_vencido'
    WHEN 'producto vencido' THEN 'producto_vencido'
    WHEN 'vencido' THEN 'producto_vencido'
    WHEN 'producto_roto' THEN 'producto_roto'
    WHEN 'producto roto' THEN 'producto_roto'
    WHEN 'producto danado/roto' THEN 'producto_roto'
    WHEN 'producto dañado/roto' THEN 'producto_roto'
    WHEN 'danado' THEN 'producto_roto'
    WHEN 'dañado' THEN 'producto_roto'
    WHEN 'mal_estado' THEN 'producto_roto'
    WHEN 'mal estado' THEN 'producto_roto'
    WHEN 'producto_faltante' THEN 'producto_faltante'
    WHEN 'producto faltante' THEN 'producto_faltante'
    WHEN 'faltante' THEN 'producto_faltante'
    WHEN 'producto_sobrante' THEN 'producto_sobrante'
    WHEN 'producto sobrante' THEN 'producto_sobrante'
    WHEN 'sobrante' THEN 'producto_sobrante'
    WHEN 'cambio' THEN 'cambio'
    WHEN 'cambio por otro producto' THEN 'cambio'
    WHEN 'error_pedido' THEN 'error_pedido'
    WHEN 'error en el pedido' THEN 'error_pedido'
    WHEN 'otro' THEN 'otro'
    ELSE regexp_replace(v_motivo, '\s+', '_', 'g')
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_hoja_ruta_devolucion_motivo ON public.hoja_ruta_devoluciones;

CREATE TRIGGER trg_normalize_hoja_ruta_devolucion_motivo
BEFORE INSERT OR UPDATE OF motivo ON public.hoja_ruta_devoluciones
FOR EACH ROW
EXECUTE FUNCTION public.normalize_hoja_ruta_devolucion_motivo();

ALTER TABLE public.hoja_ruta_devoluciones
  DROP CONSTRAINT IF EXISTS hoja_ruta_devoluciones_motivo_check;

ALTER TABLE public.hoja_ruta_devoluciones
  ADD CONSTRAINT hoja_ruta_devoluciones_motivo_check
  CHECK (motivo = ANY (ARRAY[
    'rechazo_cliente'::text,
    'producto_vencido'::text,
    'producto_roto'::text,
    'producto_faltante'::text,
    'producto_sobrante'::text,
    'cambio'::text,
    'error_pedido'::text,
    'otro'::text
  ]));