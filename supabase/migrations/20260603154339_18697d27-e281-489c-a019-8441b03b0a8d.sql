
CREATE TABLE public.chofer_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL,
  hoja_ruta_id uuid NOT NULL,
  rendicion_id uuid,
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','descontado','saldado_manual','anulado')),
  liquidacion_id uuid,
  observaciones text,
  usuario_registro_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chofer_pendientes TO authenticated;
GRANT ALL ON public.chofer_pendientes TO service_role;

ALTER TABLE public.chofer_pendientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver chofer_pendientes con permiso"
  ON public.chofer_pendientes FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'logistica', 'ver'::public.app_permission)
    OR public.has_permission(auth.uid(), 'empleados', 'ver'::public.app_permission)
  );

CREATE POLICY "Insertar chofer_pendientes con permiso"
  ON public.chofer_pendientes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'empleados', 'editar'::public.app_permission)
    OR public.has_permission(auth.uid(), 'logistica', 'editar'::public.app_permission)
  );

CREATE POLICY "Actualizar chofer_pendientes con permiso"
  ON public.chofer_pendientes FOR UPDATE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'empleados', 'editar'::public.app_permission));

CREATE POLICY "Eliminar chofer_pendientes con permiso"
  ON public.chofer_pendientes FOR DELETE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'empleados', 'eliminar'::public.app_permission));

CREATE TRIGGER chofer_pendientes_updated_at
  BEFORE UPDATE ON public.chofer_pendientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_chofer_pendientes_empleado_estado
  ON public.chofer_pendientes(empleado_id, estado);
CREATE INDEX idx_chofer_pendientes_hoja_ruta
  ON public.chofer_pendientes(hoja_ruta_id);
CREATE INDEX idx_chofer_pendientes_liquidacion
  ON public.chofer_pendientes(liquidacion_id) WHERE liquidacion_id IS NOT NULL;
