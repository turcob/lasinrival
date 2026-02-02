-- Crear enum para estados de pedido
CREATE TYPE public.pedido_estado AS ENUM (
  'pendiente',
  'confirmado', 
  'preparado',
  'despachado',
  'entregado',
  'parcial',
  'devuelto',
  'anulado'
);

-- Tabla principal de pedidos
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pedido SERIAL NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  vendedor_id UUID REFERENCES public.vendedores(id),
  usuario_id UUID NOT NULL,
  lista_precio_id UUID REFERENCES public.listas_precios(id),
  estado pedido_estado NOT NULL DEFAULT 'pendiente',
  fecha_pedido TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_entrega_estimada DATE,
  fecha_entrega_real TIMESTAMP WITH TIME ZONE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  descuento NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  observaciones TEXT,
  -- Campos de rendición
  rendido BOOLEAN DEFAULT false,
  fecha_rendicion TIMESTAMP WITH TIME ZONE,
  rendido_por UUID,
  venta_id UUID REFERENCES public.ventas(id),
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Detalles del pedido
CREATE TABLE public.pedido_detalles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id),
  cantidad_pedida NUMERIC NOT NULL,
  cantidad_entregada NUMERIC DEFAULT 0,
  cantidad_devuelta NUMERIC DEFAULT 0,
  precio_unitario NUMERIC NOT NULL,
  descuento_porcentaje NUMERIC DEFAULT 0,
  subtotal NUMERIC NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Historial de cambios de estado
CREATE TABLE public.pedido_historial (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  estado_anterior pedido_estado,
  estado_nuevo pedido_estado NOT NULL,
  usuario_id UUID NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Devoluciones de pedidos (para cuando el cliente rechaza productos)
CREATE TABLE public.pedido_devoluciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  pedido_detalle_id UUID NOT NULL REFERENCES public.pedido_detalles(id) ON DELETE CASCADE,
  cantidad NUMERIC NOT NULL,
  motivo TEXT,
  reingresado_stock BOOLEAN DEFAULT false,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Límite de crédito para clientes (agregar columna a clientes)
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS limite_credito NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS dias_gracia_vencimiento INTEGER DEFAULT 0;

-- Índices para mejor rendimiento
CREATE INDEX idx_pedidos_cliente ON public.pedidos(cliente_id);
CREATE INDEX idx_pedidos_estado ON public.pedidos(estado);
CREATE INDEX idx_pedidos_fecha ON public.pedidos(fecha_pedido);
CREATE INDEX idx_pedido_detalles_pedido ON public.pedido_detalles(pedido_id);

-- Habilitar RLS
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_devoluciones ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pedidos
CREATE POLICY "Authenticated can view pedidos" ON public.pedidos
  FOR SELECT USING (true);

CREATE POLICY "Users with permission can insert pedidos" ON public.pedidos
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'pedidos', 'crear'));

CREATE POLICY "Users with permission can update pedidos" ON public.pedidos
  FOR UPDATE USING (has_permission(auth.uid(), 'pedidos', 'editar'));

CREATE POLICY "Users with permission can delete pedidos" ON public.pedidos
  FOR DELETE USING (has_permission(auth.uid(), 'pedidos', 'eliminar'));

-- Políticas RLS para pedido_detalles
CREATE POLICY "Authenticated can view pedido_detalles" ON public.pedido_detalles
  FOR SELECT USING (true);

CREATE POLICY "Users with permission can manage pedido_detalles" ON public.pedido_detalles
  FOR ALL USING (has_permission(auth.uid(), 'pedidos', 'crear'));

-- Políticas RLS para pedido_historial
CREATE POLICY "Authenticated can view pedido_historial" ON public.pedido_historial
  FOR SELECT USING (true);

CREATE POLICY "Users with permission can insert pedido_historial" ON public.pedido_historial
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'pedidos', 'crear'));

-- Políticas RLS para pedido_devoluciones
CREATE POLICY "Authenticated can view pedido_devoluciones" ON public.pedido_devoluciones
  FOR SELECT USING (true);

CREATE POLICY "Users with permission can manage pedido_devoluciones" ON public.pedido_devoluciones
  FOR ALL USING (has_permission(auth.uid(), 'pedidos', 'editar'));

-- Trigger para updated_at
CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Vista para productos frecuentes por cliente (sugerencias)
CREATE OR REPLACE VIEW public.cliente_productos_frecuentes AS
SELECT 
  v.cliente_id,
  vd.producto_id,
  p.descripcion as producto_nombre,
  p.codigo_articulo,
  COUNT(*) as veces_comprado,
  SUM(vd.cantidad) as cantidad_total,
  MAX(v.fecha) as ultima_compra
FROM public.ventas v
JOIN public.venta_detalles vd ON v.id = vd.venta_id
JOIN public.productos p ON vd.producto_id = p.id
WHERE v.anulada = false
  AND v.cliente_id IS NOT NULL
  AND vd.producto_id IS NOT NULL
GROUP BY v.cliente_id, vd.producto_id, p.descripcion, p.codigo_articulo
ORDER BY veces_comprado DESC;