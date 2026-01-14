-- Tabla para almacenar comprobantes electrónicos AFIP
CREATE TABLE public.comprobantes_afip (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venta_id UUID REFERENCES public.ventas(id),
  tipo_comprobante INTEGER NOT NULL,
  punto_venta INTEGER NOT NULL,
  numero_comprobante INTEGER NOT NULL,
  cae VARCHAR(14) NOT NULL,
  cae_vencimiento DATE NOT NULL,
  cuit_emisor VARCHAR(11) NOT NULL,
  cuit_receptor VARCHAR(11),
  doc_tipo INTEGER NOT NULL,
  doc_nro BIGINT NOT NULL,
  importe_total NUMERIC(12,2) NOT NULL,
  importe_neto NUMERIC(12,2) NOT NULL,
  importe_iva NUMERIC(12,2) NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  estado VARCHAR(20) NOT NULL DEFAULT 'emitido',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usuario_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.comprobantes_afip ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users with permission can view comprobantes"
ON public.comprobantes_afip FOR SELECT
USING (public.has_permission(auth.uid(), 'facturacion', 'ver'));

CREATE POLICY "Users with permission can create comprobantes"
ON public.comprobantes_afip FOR INSERT
WITH CHECK (public.has_permission(auth.uid(), 'facturacion', 'crear'));

-- Index for faster lookups
CREATE INDEX idx_comprobantes_venta ON public.comprobantes_afip(venta_id);
CREATE INDEX idx_comprobantes_fecha ON public.comprobantes_afip(fecha_emision);
CREATE UNIQUE INDEX idx_comprobantes_unique ON public.comprobantes_afip(punto_venta, tipo_comprobante, numero_comprobante);

-- Add facturacion permissions to admin role
INSERT INTO public.role_permissions (role, modulo, permiso) VALUES
('admin', 'facturacion', 'ver'),
('admin', 'facturacion', 'crear'),
('admin', 'facturacion', 'editar'),
('admin', 'facturacion', 'eliminar'),
('admin', 'facturacion', 'anular'),
('admin', 'facturacion', 'exportar'),
('encargado', 'facturacion', 'ver'),
('encargado', 'facturacion', 'crear'),
('cajero', 'facturacion', 'ver'),
('cajero', 'facturacion', 'crear');