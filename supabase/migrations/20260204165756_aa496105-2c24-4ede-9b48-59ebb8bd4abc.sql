-- Tabla para trackear imputaciones de pagos a facturas
CREATE TABLE public.cliente_movimiento_imputaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_pago_id UUID NOT NULL REFERENCES cliente_movimientos(id) ON DELETE CASCADE,
  movimiento_factura_id UUID NOT NULL REFERENCES cliente_movimientos(id) ON DELETE CASCADE,
  monto NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT positive_monto CHECK (monto > 0)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_imputaciones_pago ON cliente_movimiento_imputaciones(movimiento_pago_id);
CREATE INDEX idx_imputaciones_factura ON cliente_movimiento_imputaciones(movimiento_factura_id);

-- RLS
ALTER TABLE cliente_movimiento_imputaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view imputaciones"
ON cliente_movimiento_imputaciones FOR SELECT
USING (true);

CREATE POLICY "Users with clientes permission can manage imputaciones"
ON cliente_movimiento_imputaciones FOR ALL
USING (has_permission(auth.uid(), 'clientes', 'editar'));