
ALTER TABLE public.cajas
  ADD COLUMN IF NOT EXISTS ajuste_cc_aplicado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ajuste_cc_movimiento_id uuid,
  ADD COLUMN IF NOT EXISTS ajuste_cc_empleado_id uuid REFERENCES public.empleados(id);

CREATE OR REPLACE FUNCTION public.confirmar_arqueo_con_ajuste(
  p_caja_id uuid,
  p_aplicar_ajuste boolean DEFAULT false,
  p_empleado_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_caja record;
  v_mov_id uuid;
  v_tipo text;
  v_monto numeric;
  v_concepto text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT * INTO v_caja FROM public.cajas WHERE id = p_caja_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada';
  END IF;

  IF v_caja.arqueo_confirmado THEN
    RAISE EXCEPTION 'El arqueo ya fue confirmado';
  END IF;

  IF p_aplicar_ajuste THEN
    IF NOT public.has_role(v_user, 'admin') THEN
      RAISE EXCEPTION 'Solo un administrador puede imputar el ajuste a la cuenta corriente del empleado';
    END IF;
    IF p_empleado_id IS NULL THEN
      RAISE EXCEPTION 'Debe indicar el empleado para imputar el ajuste';
    END IF;
    IF COALESCE(v_caja.diferencia, 0) = 0 THEN
      RAISE EXCEPTION 'La caja no tiene diferencia para imputar';
    END IF;

    IF v_caja.diferencia < 0 THEN
      v_tipo := 'ajuste';
      v_monto := abs(v_caja.diferencia);
      v_concepto := 'Faltante arqueo caja ' || to_char(COALESCE(v_caja.fecha_cierre, v_caja.fecha_apertura), 'DD/MM/YYYY');
    ELSE
      v_tipo := 'devolucion';
      v_monto := v_caja.diferencia;
      v_concepto := 'Sobrante arqueo caja ' || to_char(COALESCE(v_caja.fecha_cierre, v_caja.fecha_apertura), 'DD/MM/YYYY');
    END IF;

    INSERT INTO public.empleado_movimientos (empleado_id, tipo, monto, concepto, fecha, usuario_registro_id)
    VALUES (p_empleado_id, v_tipo, v_monto, v_concepto, CURRENT_DATE, v_user)
    RETURNING id INTO v_mov_id;
  END IF;

  UPDATE public.cajas
  SET arqueo_confirmado = true,
      arqueo_pendiente_revision = false,
      confirmado_por = v_user,
      fecha_confirmacion = now(),
      ajuste_cc_aplicado = COALESCE(p_aplicar_ajuste, false),
      ajuste_cc_movimiento_id = v_mov_id,
      ajuste_cc_empleado_id = CASE WHEN p_aplicar_ajuste THEN p_empleado_id ELSE NULL END
  WHERE id = p_caja_id;

  RETURN jsonb_build_object('caja_id', p_caja_id, 'movimiento_id', v_mov_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_arqueo_con_ajuste(uuid, boolean, uuid) TO authenticated;
