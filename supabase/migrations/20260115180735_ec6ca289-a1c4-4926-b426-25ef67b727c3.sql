-- Tabla de tarjetas (crédito y débito)
CREATE TABLE public.tarjetas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de cuotas para tarjetas de crédito
CREATE TABLE public.tarjeta_cuotas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarjeta_id UUID NOT NULL REFERENCES public.tarjetas(id) ON DELETE CASCADE,
  cuotas INTEGER NOT NULL,
  coeficiente NUMERIC NOT NULL DEFAULT 1,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tarjeta_id, cuotas)
);

-- Tabla de configuración de descuentos por rol
CREATE TABLE public.configuracion_descuentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  descuento_maximo_global NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role)
);

-- Tabla de descuentos por producto para roles
CREATE TABLE public.descuentos_producto_rol (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  descuento_maximo NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, producto_id)
);

-- Modificar venta_pagos para guardar datos de tarjeta
ALTER TABLE public.venta_pagos 
ADD COLUMN tarjeta_id UUID REFERENCES public.tarjetas(id),
ADD COLUMN cuotas INTEGER,
ADD COLUMN coeficiente NUMERIC DEFAULT 1,
ADD COLUMN efectivo_entregado NUMERIC,
ADD COLUMN vuelto NUMERIC;

-- Modificar venta_detalles para guardar descuento aplicado
ALTER TABLE public.venta_detalles
ADD COLUMN descuento_porcentaje NUMERIC DEFAULT 0;

-- Agregar columna para productos temporales en venta_detalles
ALTER TABLE public.venta_detalles
ALTER COLUMN producto_id DROP NOT NULL,
ADD COLUMN producto_temporal_nombre TEXT,
ADD COLUMN producto_temporal_precio NUMERIC;

-- Enable RLS
ALTER TABLE public.tarjetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarjeta_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_descuentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descuentos_producto_rol ENABLE ROW LEVEL SECURITY;

-- Policies para tarjetas
CREATE POLICY "Authenticated can view tarjetas" ON public.tarjetas
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage tarjetas" ON public.tarjetas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para tarjeta_cuotas  
CREATE POLICY "Authenticated can view tarjeta_cuotas" ON public.tarjeta_cuotas
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage tarjeta_cuotas" ON public.tarjeta_cuotas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para configuracion_descuentos
CREATE POLICY "Authenticated can view configuracion_descuentos" ON public.configuracion_descuentos
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage configuracion_descuentos" ON public.configuracion_descuentos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para descuentos_producto_rol
CREATE POLICY "Authenticated can view descuentos_producto_rol" ON public.descuentos_producto_rol
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage descuentos_producto_rol" ON public.descuentos_producto_rol
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insertar algunas tarjetas por defecto
INSERT INTO public.tarjetas (nombre, tipo) VALUES
  ('Visa Débito', 'debito'),
  ('Mastercard Débito', 'debito'),
  ('Cabal Débito', 'debito'),
  ('Visa Crédito', 'credito'),
  ('Mastercard Crédito', 'credito'),
  ('American Express', 'credito'),
  ('Naranja', 'credito'),
  ('Cabal Crédito', 'credito');

-- Insertar cuotas por defecto para tarjetas de crédito
DO $$
DECLARE
  v_tarjeta_id UUID;
  v_cuotas INT[] := ARRAY[1, 3, 6, 12, 18, 24];
  v_coef NUMERIC[] := ARRAY[1.0, 1.10, 1.20, 1.35, 1.50, 1.65];
  i INT;
BEGIN
  FOR v_tarjeta_id IN 
    SELECT id FROM public.tarjetas WHERE tipo = 'credito'
  LOOP
    FOR i IN 1..array_length(v_cuotas, 1)
    LOOP
      INSERT INTO public.tarjeta_cuotas (tarjeta_id, cuotas, coeficiente)
      VALUES (v_tarjeta_id, v_cuotas[i], v_coef[i])
      ON CONFLICT (tarjeta_id, cuotas) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Insertar configuración de descuentos por defecto
INSERT INTO public.configuracion_descuentos (role, descuento_maximo_global) VALUES
  ('admin', 100),
  ('encargado', 20),
  ('cajero', 10),
  ('vendedor', 5),
  ('deposito', 0)
ON CONFLICT (role) DO NOTHING;