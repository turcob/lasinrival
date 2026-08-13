CREATE OR REPLACE FUNCTION public.quitar_comprobante_transferencia(
  p_transferencia_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_transf record;
  v_is_priv boolean;
  v_is_owner boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT t.id, t.venta_id, t.estado, t.foto_comprobante_path, t.foto_comprobante_nombre
    INTO v_transf
    FROM public.transferencias t
   WHERE t.id = p_transferencia_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia no encontrada';
  END IF;

  IF v_transf.foto_comprobante_path IS NULL THEN
    RAISE EXCEPTION 'Esta transferencia no tiene comprobante adjunto';
  END IF;

  v_is_priv := public.has_role(v_user, 'admin'::app_role)
            OR public.has_role(v_user, 'encargado'::app_role)
            OR public.has_role(v_user, 'administracion'::app_role);

  IF NOT v_is_priv THEN
    IF v_transf.estado = 'validada' THEN
      RAISE EXCEPTION 'La transferencia ya fue validada: pedile a un administrador que quite el comprobante';
    END IF;

    IF v_transf.venta_id IS NULL THEN
      RAISE EXCEPTION 'No podés modificar una transferencia que no registraste';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.ventas v
       WHERE v.id = v_transf.venta_id
         AND v.usuario_id = v_user
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'No podés modificar una transferencia que no registraste';
    END IF;
  END IF;

  UPDATE public.transferencias
     SET foto_comprobante_path   = NULL,
         foto_comprobante_nombre = NULL
   WHERE id = p_transferencia_id;

  RETURN jsonb_build_object(
    'id', p_transferencia_id,
    'path_anterior', v_transf.foto_comprobante_path,
    'nombre_anterior', v_transf.foto_comprobante_nombre
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.quitar_comprobante_transferencia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quitar_comprobante_transferencia(uuid) TO authenticated;