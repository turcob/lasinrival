-- Create table for customer movements (cuenta corriente)
CREATE TABLE public.cliente_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'compra', 'pago', 'ajuste', 'devolucion', 'nota_credito'
  monto NUMERIC NOT NULL,
  concepto TEXT,
  venta_id UUID REFERENCES public.ventas(id),
  usuario_registro_id UUID NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create view for customer balances
CREATE VIEW public.cliente_saldos AS
SELECT 
  cliente_id,
  COALESCE(SUM(CASE WHEN tipo IN ('compra') THEN monto ELSE 0 END), 0) as total_deuda,
  COALESCE(SUM(CASE WHEN tipo IN ('pago', 'nota_credito', 'devolucion') THEN monto ELSE 0 END), 0) as total_pagado,
  COALESCE(SUM(CASE WHEN tipo = 'compra' THEN monto ELSE -monto END), 0) as saldo_actual
FROM public.cliente_movimientos
GROUP BY cliente_id;

-- Enable RLS on cliente_movimientos
ALTER TABLE public.cliente_movimientos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cliente_movimientos
CREATE POLICY "Authenticated can view cliente_movimientos"
ON public.cliente_movimientos
FOR SELECT
USING (true);

CREATE POLICY "Users with permission can insert cliente_movimientos"
ON public.cliente_movimientos
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'clientes', 'crear'));

CREATE POLICY "Users with permission can update cliente_movimientos"
ON public.cliente_movimientos
FOR UPDATE
USING (has_permission(auth.uid(), 'clientes', 'editar'));

CREATE POLICY "Users with permission can delete cliente_movimientos"
ON public.cliente_movimientos
FOR DELETE
USING (has_permission(auth.uid(), 'clientes', 'eliminar'));