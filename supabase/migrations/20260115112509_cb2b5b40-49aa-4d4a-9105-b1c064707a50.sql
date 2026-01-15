-- Agregar campo estado a ventas para distinguir pedidos de ventas confirmadas
ALTER TABLE public.ventas 
ADD COLUMN estado TEXT NOT NULL DEFAULT 'confirmada';

-- Crear índice para filtrar por estado
CREATE INDEX idx_ventas_estado ON public.ventas(estado);

-- Comentario descriptivo
COMMENT ON COLUMN public.ventas.estado IS 'Estado de la venta: pedido (pendiente de confirmar) o confirmada (facturada)';