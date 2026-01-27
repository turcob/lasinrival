-- Create table for check details
CREATE TABLE public.cheque_detalles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_movimiento_id UUID NOT NULL REFERENCES public.cliente_movimientos(id) ON DELETE CASCADE,
  numero_cheque TEXT NOT NULL,
  banco TEXT NOT NULL,
  emisor TEXT NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  cuit_emisor TEXT,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add imputation status to cliente_movimientos
ALTER TABLE public.cliente_movimientos 
ADD COLUMN estado_imputacion TEXT DEFAULT 'confirmado' CHECK (estado_imputacion IN ('pendiente', 'confirmado', 'rechazado'));

-- Add columns for imputation tracking
ALTER TABLE public.cliente_movimientos 
ADD COLUMN fecha_imputacion TIMESTAMP WITH TIME ZONE,
ADD COLUMN imputado_por UUID REFERENCES auth.users(id),
ADD COLUMN motivo_rechazo TEXT;

-- Enable RLS on cheque_detalles
ALTER TABLE public.cheque_detalles ENABLE ROW LEVEL SECURITY;

-- RLS policies for cheque_detalles
CREATE POLICY "Authenticated can view cheque_detalles"
ON public.cheque_detalles FOR SELECT
USING (true);

CREATE POLICY "Users with permission can insert cheque_detalles"
ON public.cheque_detalles FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'clientes', 'crear'));

CREATE POLICY "Users with permission can update cheque_detalles"
ON public.cheque_detalles FOR UPDATE
USING (has_permission(auth.uid(), 'clientes', 'editar'));

CREATE POLICY "Users with permission can delete cheque_detalles"
ON public.cheque_detalles FOR DELETE
USING (has_permission(auth.uid(), 'clientes', 'eliminar'));

-- Create index for faster queries
CREATE INDEX idx_cliente_movimientos_estado_imputacion ON public.cliente_movimientos(estado_imputacion);
CREATE INDEX idx_cheque_detalles_movimiento ON public.cheque_detalles(cliente_movimiento_id);