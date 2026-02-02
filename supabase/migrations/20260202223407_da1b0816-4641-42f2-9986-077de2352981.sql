-- Tabla de visitas programadas/realizadas
CREATE TABLE public.visitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  fecha_programada DATE NOT NULL,
  hora_programada TIME WITHOUT TIME ZONE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'completada', 'cancelada', 'no_visitado')),
  fecha_checkin TIMESTAMP WITH TIME ZONE,
  latitud_checkin NUMERIC,
  longitud_checkin NUMERIC,
  precision_gps NUMERIC,
  notas TEXT,
  motivo_no_visita TEXT,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de incidencias durante visitas
CREATE TABLE public.visita_incidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visita_id UUID NOT NULL REFERENCES public.visitas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('reclamo', 'devolucion', 'competencia', 'exhibicion', 'stock', 'otro')),
  descripcion TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'en_proceso', 'resuelta')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de objetivos por vendedor
CREATE TABLE public.objetivos_vendedor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id),
  periodo_mes INTEGER NOT NULL,
  periodo_anio INTEGER NOT NULL,
  meta_ventas NUMERIC DEFAULT 0,
  meta_visitas INTEGER DEFAULT 0,
  meta_cobertura_porcentaje NUMERIC DEFAULT 0,
  meta_ticket_promedio NUMERIC DEFAULT 0,
  ventas_realizadas NUMERIC DEFAULT 0,
  visitas_realizadas INTEGER DEFAULT 0,
  cobertura_actual NUMERIC DEFAULT 0,
  ticket_promedio_actual NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, periodo_mes, periodo_anio)
);

-- Tabla de objetivos por zona
CREATE TABLE public.objetivos_zona (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zona_id UUID NOT NULL REFERENCES public.zonas(id),
  periodo_mes INTEGER NOT NULL,
  periodo_anio INTEGER NOT NULL,
  meta_ventas NUMERIC DEFAULT 0,
  meta_visitas INTEGER DEFAULT 0,
  meta_clientes_nuevos INTEGER DEFAULT 0,
  ventas_realizadas NUMERIC DEFAULT 0,
  visitas_realizadas INTEGER DEFAULT 0,
  clientes_nuevos INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(zona_id, periodo_mes, periodo_anio)
);

-- Tabla de productos foco y sus objetivos
CREATE TABLE public.productos_foco (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  periodo_mes INTEGER NOT NULL,
  periodo_anio INTEGER NOT NULL,
  meta_unidades INTEGER DEFAULT 0,
  meta_monto NUMERIC DEFAULT 0,
  unidades_vendidas INTEGER DEFAULT 0,
  monto_vendido NUMERIC DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(producto_id, periodo_mes, periodo_anio)
);

-- Tabla de productos foco por vendedor (opcional, para metas específicas)
CREATE TABLE public.productos_foco_vendedor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_foco_id UUID NOT NULL REFERENCES public.productos_foco(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id),
  meta_unidades INTEGER DEFAULT 0,
  unidades_vendidas INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(producto_foco_id, vendedor_id)
);

-- Enable RLS
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visita_incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objetivos_vendedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objetivos_zona ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_foco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_foco_vendedor ENABLE ROW LEVEL SECURITY;

-- RLS Policies for visitas
CREATE POLICY "Authenticated can view visitas" ON public.visitas FOR SELECT USING (true);
CREATE POLICY "Users with permission can insert visitas" ON public.visitas FOR INSERT WITH CHECK (has_permission(auth.uid(), 'ventas', 'crear'));
CREATE POLICY "Users with permission can update visitas" ON public.visitas FOR UPDATE USING (has_permission(auth.uid(), 'ventas', 'editar'));
CREATE POLICY "Users with permission can delete visitas" ON public.visitas FOR DELETE USING (has_permission(auth.uid(), 'ventas', 'eliminar'));

-- RLS Policies for visita_incidencias
CREATE POLICY "Authenticated can view visita_incidencias" ON public.visita_incidencias FOR SELECT USING (true);
CREATE POLICY "Users with permission can manage visita_incidencias" ON public.visita_incidencias FOR ALL USING (has_permission(auth.uid(), 'ventas', 'editar'));

-- RLS Policies for objetivos_vendedor
CREATE POLICY "Authenticated can view objetivos_vendedor" ON public.objetivos_vendedor FOR SELECT USING (true);
CREATE POLICY "Admin can manage objetivos_vendedor" ON public.objetivos_vendedor FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for objetivos_zona
CREATE POLICY "Authenticated can view objetivos_zona" ON public.objetivos_zona FOR SELECT USING (true);
CREATE POLICY "Admin can manage objetivos_zona" ON public.objetivos_zona FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for productos_foco
CREATE POLICY "Authenticated can view productos_foco" ON public.productos_foco FOR SELECT USING (true);
CREATE POLICY "Admin can manage productos_foco" ON public.productos_foco FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for productos_foco_vendedor
CREATE POLICY "Authenticated can view productos_foco_vendedor" ON public.productos_foco_vendedor FOR SELECT USING (true);
CREATE POLICY "Admin can manage productos_foco_vendedor" ON public.productos_foco_vendedor FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_visitas_updated_at BEFORE UPDATE ON public.visitas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_objetivos_vendedor_updated_at BEFORE UPDATE ON public.objetivos_vendedor FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_objetivos_zona_updated_at BEFORE UPDATE ON public.objetivos_zona FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_productos_foco_updated_at BEFORE UPDATE ON public.productos_foco FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();