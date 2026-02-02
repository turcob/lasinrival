-- Tabla de vehículos
CREATE TABLE public.vehiculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patente TEXT NOT NULL UNIQUE,
  marca TEXT,
  modelo TEXT,
  capacidad_kg NUMERIC,
  capacidad_bultos INTEGER,
  activo BOOLEAN DEFAULT true,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;

-- Políticas para vehículos
CREATE POLICY "Authenticated can view vehiculos" ON public.vehiculos FOR SELECT USING (true);
CREATE POLICY "Users with permission can insert vehiculos" ON public.vehiculos FOR INSERT WITH CHECK (has_permission(auth.uid(), 'logistica', 'crear'));
CREATE POLICY "Users with permission can update vehiculos" ON public.vehiculos FOR UPDATE USING (has_permission(auth.uid(), 'logistica', 'editar'));
CREATE POLICY "Users with permission can delete vehiculos" ON public.vehiculos FOR DELETE USING (has_permission(auth.uid(), 'logistica', 'eliminar'));

-- Trigger para updated_at vehiculos
CREATE TRIGGER update_vehiculos_updated_at BEFORE UPDATE ON public.vehiculos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de hojas de ruta
CREATE TABLE public.hojas_ruta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_hoja SERIAL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  vehiculo_id UUID REFERENCES public.vehiculos(id),
  chofer_id UUID REFERENCES public.empleados(id),
  responsable_id UUID REFERENCES public.empleados(id),
  estado TEXT NOT NULL DEFAULT 'planificada' CHECK (estado IN ('planificada', 'en_carga', 'en_ruta', 'completada', 'cancelada')),
  hora_salida_estimada TIME,
  hora_salida_real TIMESTAMP WITH TIME ZONE,
  hora_regreso TIMESTAMP WITH TIME ZONE,
  km_inicial NUMERIC,
  km_final NUMERIC,
  observaciones TEXT,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.hojas_ruta ENABLE ROW LEVEL SECURITY;

-- Políticas para hojas_ruta
CREATE POLICY "Authenticated can view hojas_ruta" ON public.hojas_ruta FOR SELECT USING (true);
CREATE POLICY "Users with permission can insert hojas_ruta" ON public.hojas_ruta FOR INSERT WITH CHECK (has_permission(auth.uid(), 'logistica', 'crear'));
CREATE POLICY "Users with permission can update hojas_ruta" ON public.hojas_ruta FOR UPDATE USING (has_permission(auth.uid(), 'logistica', 'editar'));
CREATE POLICY "Users with permission can delete hojas_ruta" ON public.hojas_ruta FOR DELETE USING (has_permission(auth.uid(), 'logistica', 'eliminar'));

-- Tabla de paradas
CREATE TABLE public.hoja_ruta_paradas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hoja_ruta_id UUID NOT NULL REFERENCES public.hojas_ruta(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id),
  orden INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_camino', 'entregado', 'entrega_parcial', 'rechazado', 'no_entregado')),
  hora_llegada TIMESTAMP WITH TIME ZONE,
  hora_salida TIMESTAMP WITH TIME ZONE,
  ventana_horaria_desde TIME,
  ventana_horaria_hasta TIME,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(hoja_ruta_id, pedido_id)
);

-- Habilitar RLS
ALTER TABLE public.hoja_ruta_paradas ENABLE ROW LEVEL SECURITY;

-- Políticas para hoja_ruta_paradas
CREATE POLICY "Authenticated can view hoja_ruta_paradas" ON public.hoja_ruta_paradas FOR SELECT USING (true);
CREATE POLICY "Users with permission can manage hoja_ruta_paradas" ON public.hoja_ruta_paradas FOR ALL USING (has_permission(auth.uid(), 'logistica', 'editar'));

-- Tabla para devoluciones en ruta
CREATE TABLE public.hoja_ruta_devoluciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hoja_ruta_id UUID NOT NULL REFERENCES public.hojas_ruta(id) ON DELETE CASCADE,
  parada_id UUID NOT NULL REFERENCES public.hoja_ruta_paradas(id) ON DELETE CASCADE,
  pedido_detalle_id UUID NOT NULL REFERENCES public.pedido_detalles(id),
  cantidad NUMERIC NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('rechazo_cliente', 'producto_vencido', 'producto_roto', 'producto_faltante', 'cambio', 'error_pedido', 'otro')),
  detalle_motivo TEXT,
  reingresado_stock BOOLEAN DEFAULT false,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.hoja_ruta_devoluciones ENABLE ROW LEVEL SECURITY;

-- Políticas para hoja_ruta_devoluciones
CREATE POLICY "Authenticated can view hoja_ruta_devoluciones" ON public.hoja_ruta_devoluciones FOR SELECT USING (true);
CREATE POLICY "Users with permission can manage hoja_ruta_devoluciones" ON public.hoja_ruta_devoluciones FOR ALL USING (has_permission(auth.uid(), 'logistica', 'editar'));

-- Triggers para updated_at
CREATE TRIGGER update_hojas_ruta_updated_at BEFORE UPDATE ON public.hojas_ruta FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hoja_ruta_paradas_updated_at BEFORE UPDATE ON public.hoja_ruta_paradas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permisos para el módulo logística
INSERT INTO role_permissions (role, modulo, permiso) VALUES
('admin', 'logistica', 'ver'),
('admin', 'logistica', 'crear'),
('admin', 'logistica', 'editar'),
('admin', 'logistica', 'eliminar'),
('admin', 'logistica', 'exportar'),
('encargado', 'logistica', 'ver'),
('encargado', 'logistica', 'crear'),
('encargado', 'logistica', 'editar'),
('vendedor', 'logistica', 'ver'),
('cajero', 'logistica', 'ver')
ON CONFLICT DO NOTHING;