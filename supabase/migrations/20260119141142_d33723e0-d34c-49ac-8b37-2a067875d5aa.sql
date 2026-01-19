-- Crear tabla de sucursales
CREATE TABLE public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  direccion TEXT,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated can view sucursales"
ON public.sucursales FOR SELECT
USING (true);

CREATE POLICY "Admin can manage sucursales"
ON public.sucursales FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Agregar columna sucursal_id a empleados
ALTER TABLE public.empleados 
ADD COLUMN sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL;