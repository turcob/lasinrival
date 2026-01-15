-- Crear tabla de marcas
CREATE TABLE public.marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de tipos de producto
CREATE TABLE public.tipos_producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS en ambas tablas
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_producto ENABLE ROW LEVEL SECURITY;

-- Políticas para marcas
CREATE POLICY "Authenticated can view marcas" ON public.marcas FOR SELECT USING (true);
CREATE POLICY "Users with permission can manage marcas" ON public.marcas FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para tipos_producto
CREATE POLICY "Authenticated can view tipos_producto" ON public.tipos_producto FOR SELECT USING (true);
CREATE POLICY "Users with permission can manage tipos_producto" ON public.tipos_producto FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Agregar columnas a productos
ALTER TABLE public.productos ADD COLUMN marca_id uuid REFERENCES public.marcas(id);
ALTER TABLE public.productos ADD COLUMN tipo_producto_id uuid REFERENCES public.tipos_producto(id);
ALTER TABLE public.productos ADD COLUMN cantidad_por_empaque integer DEFAULT 1;

-- Modificar listas_precios para soportar niveles y prioridad
ALTER TABLE public.listas_precios ADD COLUMN nivel text DEFAULT 'global' CHECK (nivel IN ('global', 'marca', 'tipo_producto'));
ALTER TABLE public.listas_precios ADD COLUMN prioridad integer DEFAULT 1;
ALTER TABLE public.listas_precios ADD COLUMN marca_id uuid REFERENCES public.marcas(id);
ALTER TABLE public.listas_precios ADD COLUMN tipo_producto_id uuid REFERENCES public.tipos_producto(id);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_productos_marca ON public.productos(marca_id);
CREATE INDEX idx_productos_tipo ON public.productos(tipo_producto_id);
CREATE INDEX idx_listas_nivel ON public.listas_precios(nivel);
CREATE INDEX idx_listas_marca ON public.listas_precios(marca_id);
CREATE INDEX idx_listas_tipo ON public.listas_precios(tipo_producto_id);