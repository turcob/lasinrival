
-- Trigger automático: cuando todos los items de carga de una hoja están verificados
-- (es decir ninguno queda en estado 'pendiente'), pasa la hoja_ruta de 'en_carga'
-- a 'carga_confirmada' automáticamente, registrando timestamp y usuario.

CREATE OR REPLACE FUNCTION public.auto_confirmar_carga_hoja_ruta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoja_id uuid;
  v_estado text;
  v_pendientes int;
  v_total int;
BEGIN
  v_hoja_id := COALESCE(NEW.hoja_ruta_id, OLD.hoja_ruta_id);

  SELECT estado INTO v_estado
  FROM public.hojas_ruta
  WHERE id = v_hoja_id;

  -- Sólo actuar si la hoja está en 'en_carga'
  IF v_estado IS DISTINCT FROM 'en_carga' THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE estado = 'pendiente'),
    COUNT(*)
  INTO v_pendientes, v_total
  FROM public.hoja_ruta_carga_items
  WHERE hoja_ruta_id = v_hoja_id;

  -- Si hay items y ninguno está pendiente, confirmar carga
  IF v_total > 0 AND v_pendientes = 0 THEN
    UPDATE public.hojas_ruta
    SET estado = 'carga_confirmada',
        carga_confirmada_at = COALESCE(carga_confirmada_at, now()),
        carga_confirmada_por = COALESCE(carga_confirmada_por, NEW.verificado_por),
        carga_forzada = false,
        updated_at = now()
    WHERE id = v_hoja_id
      AND estado = 'en_carga';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirmar_carga ON public.hoja_ruta_carga_items;

CREATE TRIGGER trg_auto_confirmar_carga
AFTER INSERT OR UPDATE ON public.hoja_ruta_carga_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirmar_carga_hoja_ruta();
