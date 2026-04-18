-- Add tipo_pedido column to pedidos table
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS tipo_pedido text NOT NULL DEFAULT 'reparto';

-- Add check constraint to ensure only valid values
ALTER TABLE public.pedidos
DROP CONSTRAINT IF EXISTS pedidos_tipo_pedido_check;

ALTER TABLE public.pedidos
ADD CONSTRAINT pedidos_tipo_pedido_check 
CHECK (tipo_pedido IN ('web', 'reparto'));

-- Index for filtering performance
CREATE INDEX IF NOT EXISTS idx_pedidos_tipo_pedido ON public.pedidos(tipo_pedido);