CREATE OR REPLACE FUNCTION public.adjuntar_comprobante_transferencia(
  p_transferencia_id uuid,
  p_path text,
  p_nombre text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_transf record;
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_path IS NULL OR length(trim(p_path)) = 0 THEN
    RAISE EXCEPTION 'Falta el path del comprobante';
  END IF;

  SELECT t.id, t.venta_id, t.foto_comprobante_path
    INTO v_transf
    FROM public.transferencias t
   WHERE t.id = p_transferencia_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada';
  END IF;

  IF v_transf.foto_comprobante_path IS NOT NULL THEN
    RAISE EXCEPTION 'Esta transferencia ya tiene comprobante cargado';
  END IF;

  v_is_admin := public.has_role(v_user, 'admin'::app_role);

  IF NOT v_is_admin THEN
    IF v_transf.venta_id IS NULL THEN
      RAISE EXCEPTION 'No podés adjuntar comprobante a una transferencia que no registraste';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.ventas v
       WHERE v.id = v_transf.venta_id
         AND v.usuario_id = v_user
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'No podés adjuntar comprobante a una transferencia que no registraste';
    END IF;
  END IF;

  UPDATE public.transferencias
     SET foto_comprobante_path   = p_path,
         foto_comprobante_nombre = p_nombre
   WHERE id = p_transferencia_id;

  RETURN jsonb_build_object(
    'id', p_transferencia_id,
    'foto_comprobante_path', p_path,
    'foto_comprobante_nombre', p_nombre
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.adjuntar_comprobante_transferencia(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjuntar_comprobante_transferencia(uuid, text, text) TO authenticated;