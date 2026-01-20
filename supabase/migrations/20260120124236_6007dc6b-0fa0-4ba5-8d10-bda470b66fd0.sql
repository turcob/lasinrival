-- Crear tabla de zonas
CREATE TABLE public.zonas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Crear tabla de vendedores (asociados a empleados)
CREATE TABLE public.vendedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Crear tabla de provincias
CREATE TABLE public.provincias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Crear tabla de condiciones de venta
CREATE TABLE public.condiciones_venta (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  descripcion text NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Agregar nuevos campos a clientes
ALTER TABLE public.clientes 
ADD COLUMN codigo_cliente text UNIQUE,
ADD COLUMN zona_id uuid REFERENCES public.zonas(id) ON DELETE SET NULL,
ADD COLUMN vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
ADD COLUMN provincia_id uuid REFERENCES public.provincias(id) ON DELETE SET NULL,
ADD COLUMN condicion_venta_id uuid REFERENCES public.condiciones_venta(id) ON DELETE SET NULL,
ADD COLUMN codigo_postal text,
ADD COLUMN telefono_contacto text,
ADD COLUMN fecha_alta date;

-- Habilitar RLS en nuevas tablas
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provincias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condiciones_venta ENABLE ROW LEVEL SECURITY;

-- Políticas para zonas
CREATE POLICY "Authenticated can view zonas" ON public.zonas FOR SELECT USING (true);
CREATE POLICY "Admin can manage zonas" ON public.zonas FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para vendedores
CREATE POLICY "Authenticated can view vendedores" ON public.vendedores FOR SELECT USING (true);
CREATE POLICY "Admin can manage vendedores" ON public.vendedores FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para provincias
CREATE POLICY "Authenticated can view provincias" ON public.provincias FOR SELECT USING (true);
CREATE POLICY "Admin can manage provincias" ON public.provincias FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para condiciones_venta
CREATE POLICY "Authenticated can view condiciones_venta" ON public.condiciones_venta FOR SELECT USING (true);
CREATE POLICY "Admin can manage condiciones_venta" ON public.condiciones_venta FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers para updated_at
CREATE TRIGGER update_zonas_updated_at BEFORE UPDATE ON public.zonas 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedores_updated_at BEFORE UPDATE ON public.vendedores 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();