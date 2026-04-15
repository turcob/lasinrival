
-- Drop conflicting policies first, then recreate
DO $$ BEGIN
  -- objetivos_zona policies
  DROP POLICY IF EXISTS "Authenticated can view objetivos_zona" ON public.objetivos_zona;
  DROP POLICY IF EXISTS "Users with permission can manage objetivos_zona" ON public.objetivos_zona;
  -- productos_foco policies  
  DROP POLICY IF EXISTS "Authenticated can view productos_foco" ON public.productos_foco;
  DROP POLICY IF EXISTS "Users with permission can manage productos_foco" ON public.productos_foco;
  -- productos_foco_vendedor policies
  DROP POLICY IF EXISTS "Authenticated can view productos_foco_vendedor" ON public.productos_foco_vendedor;
  DROP POLICY IF EXISTS "Users with permission can manage productos_foco_vendedor" ON public.productos_foco_vendedor;
  -- visitas policies
  DROP POLICY IF EXISTS "Authenticated can view visitas" ON public.visitas;
  DROP POLICY IF EXISTS "Users with permission can manage visitas" ON public.visitas;
END $$;

-- objetivos_zona
CREATE TABLE IF NOT EXISTS public.objetivos_zona (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zona_id UUID NOT NULL REFERENCES public.zonas(id) ON DELETE CASCADE,
  periodo_mes INTEGER NOT NULL,
  periodo_anio INTEGER NOT NULL,
  meta_ventas NUMERIC DEFAULT 0,
  meta_visitas INTEGER DEFAULT 0,
  meta_clientes_nuevos INTEGER DEFAULT 0,
  ventas_realizadas NUMERIC DEFAULT 0,
  visitas_realizadas INTEGER DEFAULT 0,
  clientes_nuevos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(zona_id, periodo_mes, periodo_anio)
);
ALTER TABLE public.objetivos_zona ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view objetivos_zona" ON public.objetivos_zona FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage objetivos_zona" ON public.objetivos_zona FOR ALL TO authenticated USING (has_permission(auth.uid(), 'ventas'::text, 'crear'::app_permission)) WITH CHECK (has_permission(auth.uid(), 'ventas'::text, 'crear'::app_permission));

-- productos_foco
CREATE TABLE IF NOT EXISTS public.productos_foco (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  periodo_mes INTEGER NOT NULL,
  periodo_anio INTEGER NOT NULL,
  meta_unidades INTEGER DEFAULT 0,
  meta_monto NUMERIC DEFAULT 0,
  unidades_vendidas INTEGER DEFAULT 0,
  monto_vendido NUMERIC DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.productos_foco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view productos_foco" ON public.productos_foco FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage productos_foco" ON public.productos_foco FOR ALL TO authenticated USING (has_permission(auth.uid(), 'ventas'::text, 'crear'::app_permission)) WITH CHECK (has_permission(auth.uid(), 'ventas'::text, 'crear'::app_permission));

-- productos_foco_vendedor
CREATE TABLE IF NOT EXISTS public.productos_foco_vendedor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_foco_id UUID NOT NULL REFERENCES public.productos_foco(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  meta_unidades INTEGER DEFAULT 0,
  unidades_vendidas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.productos_foco_vendedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view productos_foco_vendedor" ON public.productos_foco_vendedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage productos_foco_vendedor" ON public.productos_foco_vendedor FOR ALL TO authenticated USING (has_permission(auth.uid(), 'ventas'::text, 'crear'::app_permission)) WITH CHECK (has_permission(auth.uid(), 'ventas'::text, 'crear'::app_permission));

-- visitas
CREATE TABLE IF NOT EXISTS public.visitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  fecha_programada DATE NOT NULL,
  hora_programada TIME,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  fecha_checkin TIMESTAMPTZ,
  latitud_checkin NUMERIC,
  longitud_checkin NUMERIC,
  precision_gps NUMERIC,
  notas TEXT,
  motivo_no_visita TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view visitas" ON public.visitas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage visitas" ON public.visitas FOR ALL TO authenticated USING (has_permission(auth.uid(), 'ventas'::text, 'crear'::app_permission)) WITH CHECK (has_permission(auth.uid(), 'ventas'::text, 'crear'::app_permission));
