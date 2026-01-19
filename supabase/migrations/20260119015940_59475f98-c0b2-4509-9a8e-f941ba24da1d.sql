-- Crear tabla empleados
CREATE TABLE public.empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  dni TEXT UNIQUE,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  fecha_ingreso DATE,
  sueldo_base NUMERIC(12,2) DEFAULT 0,
  cargo TEXT,
  estado_civil TEXT,
  cbu_cuenta TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla empleado_movimientos
CREATE TABLE public.empleado_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('compra', 'adelanto', 'devolucion', 'ajuste', 'liquidacion', 'comision')),
  monto NUMERIC(12,2) NOT NULL,
  concepto TEXT,
  venta_id UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
  usuario_registro_id UUID NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla empleado_liquidaciones
CREATE TABLE public.empleado_liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio INTEGER NOT NULL,
  sueldo_base NUMERIC(12,2) NOT NULL,
  total_descuentos NUMERIC(12,2) DEFAULT 0,
  total_comisiones NUMERIC(12,2) DEFAULT 0,
  neto_a_pagar NUMERIC(12,2) NOT NULL,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada')),
  fecha_pago DATE,
  observaciones TEXT,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (empleado_id, mes, anio)
);

-- Agregar columna empleado_id a ventas
ALTER TABLE public.ventas ADD COLUMN empleado_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL;

-- Crear vista empleado_saldos
CREATE VIEW public.empleado_saldos AS
SELECT 
  empleado_id,
  COALESCE(SUM(CASE WHEN tipo IN ('compra', 'adelanto') THEN monto ELSE 0 END), 0) as total_deuda,
  COALESCE(SUM(CASE WHEN tipo IN ('devolucion', 'liquidacion') THEN monto ELSE 0 END), 0) as total_pagado,
  COALESCE(SUM(CASE WHEN tipo = 'comision' THEN monto ELSE 0 END), 0) as total_comisiones,
  COALESCE(SUM(CASE WHEN tipo IN ('compra', 'adelanto') THEN monto ELSE -monto END), 0) as saldo_actual
FROM public.empleado_movimientos
GROUP BY empleado_id;

-- Trigger para updated_at en empleados
CREATE TRIGGER update_empleados_updated_at
BEFORE UPDATE ON public.empleados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleado_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleado_liquidaciones ENABLE ROW LEVEL SECURITY;

-- RLS policies para empleados
CREATE POLICY "Authenticated can view empleados"
ON public.empleados FOR SELECT
USING (true);

CREATE POLICY "Users with permission can insert empleados"
ON public.empleados FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'empleados', 'crear'));

CREATE POLICY "Users with permission can update empleados"
ON public.empleados FOR UPDATE
USING (has_permission(auth.uid(), 'empleados', 'editar'));

CREATE POLICY "Users with permission can delete empleados"
ON public.empleados FOR DELETE
USING (has_permission(auth.uid(), 'empleados', 'eliminar'));

-- RLS policies para empleado_movimientos
CREATE POLICY "Authenticated can view empleado_movimientos"
ON public.empleado_movimientos FOR SELECT
USING (true);

CREATE POLICY "Users with permission can insert empleado_movimientos"
ON public.empleado_movimientos FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'empleados', 'crear'));

CREATE POLICY "Users with permission can update empleado_movimientos"
ON public.empleado_movimientos FOR UPDATE
USING (has_permission(auth.uid(), 'empleados', 'editar'));

CREATE POLICY "Users with permission can delete empleado_movimientos"
ON public.empleado_movimientos FOR DELETE
USING (has_permission(auth.uid(), 'empleados', 'eliminar'));

-- RLS policies para empleado_liquidaciones
CREATE POLICY "Authenticated can view empleado_liquidaciones"
ON public.empleado_liquidaciones FOR SELECT
USING (true);

CREATE POLICY "Users with permission can insert empleado_liquidaciones"
ON public.empleado_liquidaciones FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'empleados', 'crear'));

CREATE POLICY "Users with permission can update empleado_liquidaciones"
ON public.empleado_liquidaciones FOR UPDATE
USING (has_permission(auth.uid(), 'empleados', 'editar'));

CREATE POLICY "Users with permission can delete empleado_liquidaciones"
ON public.empleado_liquidaciones FOR DELETE
USING (has_permission(auth.uid(), 'empleados', 'eliminar'));