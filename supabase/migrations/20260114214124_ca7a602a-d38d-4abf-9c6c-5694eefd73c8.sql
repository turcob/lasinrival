-- Crear tabla de configuración del comercio
CREATE TABLE public.configuracion_comercio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razon_social TEXT NOT NULL,
  nombre_fantasia TEXT,
  cuit TEXT NOT NULL,
  direccion TEXT NOT NULL,
  localidad TEXT,
  provincia TEXT,
  codigo_postal TEXT,
  telefono TEXT,
  email TEXT,
  condicion_iva TEXT NOT NULL DEFAULT 'IVA Responsable Inscripto',
  inicio_actividades DATE,
  punto_venta INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracion_comercio ENABLE ROW LEVEL SECURITY;

-- Solo usuarios con rol pueden ver la configuración
CREATE POLICY "Usuarios autenticados pueden ver configuración"
ON public.configuracion_comercio
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Solo admins pueden modificar
CREATE POLICY "Admins pueden modificar configuración"
ON public.configuracion_comercio
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_configuracion_comercio_updated_at
BEFORE UPDATE ON public.configuracion_comercio
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar configuración inicial (placeholder para que el usuario la complete)
INSERT INTO public.configuracion_comercio (razon_social, cuit, direccion, condicion_iva)
VALUES ('Mi Comercio S.R.L.', '20123456789', 'Av. Principal 123, Ciudad', 'IVA Responsable Inscripto');