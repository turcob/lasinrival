
-- 1. CREATE TABLE
CREATE TABLE public.transferencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  titular_nombre text NOT NULL,
  titular_cuil text,
  numero_operacion text,
  importe numeric NOT NULL CHECK (importe > 0),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','validada','rechazada')),
  observacion_rechazo text,
  origen text NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual','venta','cobro_cc')),
  venta_id uuid REFERENCES public.ventas(id) ON DELETE SET NULL,
  cobro_id uuid REFERENCES public.cobros(id) ON DELETE SET NULL,
  cliente_movimiento_id uuid REFERENCES public.cliente_movimientos(id) ON DELETE SET NULL,
  creado_por uuid,
  validado_por uuid,
  validado_at timestamptz,
  rechazado_por uuid,
  rechazado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transferencias TO authenticated;
GRANT ALL ON public.transferencias TO service_role;

-- 3. ENABLE RLS
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
CREATE POLICY "Ver transferencias con permiso"
  ON public.transferencias FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'transferencias', 'ver')
  );

CREATE POLICY "Crear transferencias con permiso"
  ON public.transferencias FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'transferencias', 'crear')
  );

CREATE POLICY "Editar transferencias con permiso"
  ON public.transferencias FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'transferencias', 'editar')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'transferencias', 'editar')
  );

CREATE POLICY "Eliminar transferencias admin"
  ON public.transferencias FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indices
CREATE UNIQUE INDEX transferencias_cliente_num_op_uidx
  ON public.transferencias (cliente_id, numero_operacion)
  WHERE numero_operacion IS NOT NULL AND numero_operacion <> '';
CREATE INDEX transferencias_estado_idx ON public.transferencias (estado);
CREATE INDEX transferencias_cliente_idx ON public.transferencias (cliente_id);
CREATE INDEX transferencias_fecha_idx ON public.transferencias (fecha_transferencia DESC);

-- Trigger updated_at
CREATE TRIGGER trg_transferencias_updated_at
  BEFORE UPDATE ON public.transferencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger transiciones de estado
CREATE OR REPLACE FUNCTION public.transferencias_validar_transicion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF NEW.estado = OLD.estado THEN
    RETURN NEW;
  END IF;

  -- validada -> pendiente nunca
  IF OLD.estado = 'validada' AND NEW.estado = 'pendiente' THEN
    RAISE EXCEPTION 'No se puede volver una transferencia validada al estado pendiente';
  END IF;

  -- desde rechazada solo admin
  IF OLD.estado = 'rechazada' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo un administrador puede modificar una transferencia rechazada';
  END IF;

  -- al rechazar exige observación
  IF NEW.estado = 'rechazada' THEN
    IF NEW.observacion_rechazo IS NULL OR length(trim(NEW.observacion_rechazo)) = 0 THEN
      RAISE EXCEPTION 'Debe indicar la observación del rechazo';
    END IF;
    NEW.rechazado_por := COALESCE(NEW.rechazado_por, auth.uid());
    NEW.rechazado_at := COALESCE(NEW.rechazado_at, now());
  END IF;

  IF NEW.estado = 'validada' THEN
    NEW.validado_por := COALESCE(NEW.validado_por, auth.uid());
    NEW.validado_at := COALESCE(NEW.validado_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transferencias_transicion
  BEFORE UPDATE OF estado ON public.transferencias
  FOR EACH ROW EXECUTE FUNCTION public.transferencias_validar_transicion();

-- Seed de permisos para admin
INSERT INTO public.role_permissions (role, modulo, permiso)
SELECT 'admin'::app_role, 'transferencias', p::app_permission
FROM (VALUES ('ver'),('crear'),('editar')) AS t(p)
ON CONFLICT DO NOTHING;
