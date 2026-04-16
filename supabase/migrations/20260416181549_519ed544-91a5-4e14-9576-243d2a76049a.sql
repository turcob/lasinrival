-- Tabla de Notas de Crédito Pendientes
CREATE TABLE public.notas_credito_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  pedido_detalle_id UUID,
  hoja_ruta_id UUID REFERENCES public.hojas_ruta(id) ON DELETE SET NULL,
  parada_id UUID,
  origen TEXT NOT NULL CHECK (origen IN ('rechazo_logistica', 'devolucion_manual', 'rechazo_pedido')),
  cantidad NUMERIC NOT NULL,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  importe_total NUMERIC NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL,
  detalle_motivo TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'descartada')),
  reingresar_stock BOOLEAN DEFAULT true,
  generar_nc BOOLEAN DEFAULT true,
  cliente_movimiento_id UUID REFERENCES public.cliente_movimientos(id) ON DELETE SET NULL,
  observaciones_admin TEXT,
  usuario_creador_id UUID NOT NULL,
  usuario_aprobador_id UUID,
  fecha_aprobacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ncp_cliente ON public.notas_credito_pendientes(cliente_id);
CREATE INDEX idx_ncp_estado ON public.notas_credito_pendientes(estado);
CREATE INDEX idx_ncp_origen ON public.notas_credito_pendientes(origen);

ALTER TABLE public.notas_credito_pendientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notas_credito_pendientes"
ON public.notas_credito_pendientes FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Users with permission can insert notas_credito_pendientes"
ON public.notas_credito_pendientes FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'clientes', 'crear') OR has_permission(auth.uid(), 'logistica', 'crear'));

CREATE POLICY "Users with permission can update notas_credito_pendientes"
ON public.notas_credito_pendientes FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'clientes', 'editar'));

CREATE POLICY "Users with permission can delete notas_credito_pendientes"
ON public.notas_credito_pendientes FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'clientes', 'eliminar'));

CREATE TRIGGER update_ncp_updated_at
BEFORE UPDATE ON public.notas_credito_pendientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de Devoluciones Manuales (productos devueltos sin pedido)
CREATE TABLE public.devoluciones_manuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  cantidad NUMERIC NOT NULL,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  importe_total NUMERIC NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL,
  detalle_motivo TEXT,
  generar_nc BOOLEAN DEFAULT true,
  reingresar_stock BOOLEAN DEFAULT true,
  nc_pendiente_id UUID REFERENCES public.notas_credito_pendientes(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  observaciones TEXT,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_cliente ON public.devoluciones_manuales(cliente_id);
CREATE INDEX idx_dm_producto ON public.devoluciones_manuales(producto_id);
CREATE INDEX idx_dm_fecha ON public.devoluciones_manuales(fecha);

ALTER TABLE public.devoluciones_manuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view devoluciones_manuales"
ON public.devoluciones_manuales FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Users with permission can insert devoluciones_manuales"
ON public.devoluciones_manuales FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'clientes', 'crear'));

CREATE POLICY "Users with permission can update devoluciones_manuales"
ON public.devoluciones_manuales FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'clientes', 'editar'));

CREATE POLICY "Users with permission can delete devoluciones_manuales"
ON public.devoluciones_manuales FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'clientes', 'eliminar'));