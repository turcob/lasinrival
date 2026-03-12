
-- Enum para estados del cheque
CREATE TYPE public.cheque_estado AS ENUM (
  'en_cartera', 'depositado', 'cobrado', 'rechazado', 'endosado', 'vencido', 'anulado'
);

-- Enum para tipo de cheque
CREATE TYPE public.cheque_tipo AS ENUM ('terceros', 'propio');

-- Tabla principal de cheques
CREATE TABLE public.cheques (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo cheque_tipo NOT NULL DEFAULT 'terceros',
  estado cheque_estado NOT NULL DEFAULT 'en_cartera',
  numero_cheque TEXT NOT NULL,
  banco TEXT NOT NULL,
  sucursal_banco TEXT,
  emisor TEXT NOT NULL,
  cuit_emisor TEXT,
  beneficiario TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  monto NUMERIC NOT NULL DEFAULT 0,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  fecha_deposito DATE,
  fecha_cobro DATE,
  fecha_rechazo DATE,
  fecha_endoso DATE,
  motivo_rechazo TEXT,
  endosado_a TEXT,
  cuenta_deposito TEXT,
  banco_deposito TEXT,
  observaciones TEXT,
  cliente_movimiento_id UUID REFERENCES public.cliente_movimientos(id),
  usuario_registro_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de historial de cambios de estado
CREATE TABLE public.cheque_historial (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cheque_id UUID NOT NULL REFERENCES public.cheques(id) ON DELETE CASCADE,
  estado_anterior cheque_estado,
  estado_nuevo cheque_estado NOT NULL,
  usuario_id UUID NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheque_historial ENABLE ROW LEVEL SECURITY;

-- RLS policies for cheques
CREATE POLICY "Authenticated can view cheques" ON public.cheques
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users with permission can insert cheques" ON public.cheques
  FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'cheques'::text, 'crear'::app_permission));

CREATE POLICY "Users with permission can update cheques" ON public.cheques
  FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'cheques'::text, 'editar'::app_permission));

CREATE POLICY "Users with permission can delete cheques" ON public.cheques
  FOR DELETE TO authenticated USING (has_permission(auth.uid(), 'cheques'::text, 'eliminar'::app_permission));

-- RLS policies for cheque_historial
CREATE POLICY "Authenticated can view cheque_historial" ON public.cheque_historial
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert cheque_historial" ON public.cheque_historial
  FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_cheques_updated_at
  BEFORE UPDATE ON public.cheques
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
