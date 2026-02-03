-- Tabla para registrar pagos recibidos durante la entrega (por parada)
CREATE TABLE public.hoja_ruta_cobros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_ruta_id UUID NOT NULL REFERENCES public.hojas_ruta(id) ON DELETE CASCADE,
  parada_id UUID NOT NULL REFERENCES public.hoja_ruta_paradas(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id),
  forma_pago_id UUID NOT NULL REFERENCES public.formas_pago(id),
  monto NUMERIC NOT NULL DEFAULT 0,
  referencia TEXT, -- Número de transferencia, código QR, etc.
  observaciones TEXT,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla para registrar la rendición de cobranza por hoja de ruta
CREATE TABLE public.hoja_ruta_rendiciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_ruta_id UUID NOT NULL REFERENCES public.hojas_ruta(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL, -- quien realiza la rendición
  fecha_rendicion TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_efectivo NUMERIC NOT NULL DEFAULT 0,
  total_transferencias NUMERIC NOT NULL DEFAULT 0,
  total_qr NUMERIC NOT NULL DEFAULT 0,
  total_tarjeta NUMERIC NOT NULL DEFAULT 0,
  total_general NUMERIC NOT NULL DEFAULT 0,
  diferencia NUMERIC DEFAULT 0, -- diferencia entre cobrado y rendido
  caja_id UUID REFERENCES public.cajas(id), -- caja donde se deposita el efectivo
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  aprobado_por UUID,
  fecha_aprobacion TIMESTAMPTZ,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agregar campo para marcar si el pedido fue cobrado en entrega
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS cobrado_en_entrega BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS monto_cobrado NUMERIC DEFAULT 0;

-- Enable RLS
ALTER TABLE public.hoja_ruta_cobros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoja_ruta_rendiciones ENABLE ROW LEVEL SECURITY;

-- Políticas para hoja_ruta_cobros
CREATE POLICY "Authenticated can view hoja_ruta_cobros"
ON public.hoja_ruta_cobros FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users with permission can insert hoja_ruta_cobros"
ON public.hoja_ruta_cobros FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'logistica', 'crear'));

CREATE POLICY "Users with permission can update hoja_ruta_cobros"
ON public.hoja_ruta_cobros FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'logistica', 'editar'));

CREATE POLICY "Users with permission can delete hoja_ruta_cobros"
ON public.hoja_ruta_cobros FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'logistica', 'eliminar'));

-- Políticas para hoja_ruta_rendiciones
CREATE POLICY "Authenticated can view hoja_ruta_rendiciones"
ON public.hoja_ruta_rendiciones FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users with permission can insert hoja_ruta_rendiciones"
ON public.hoja_ruta_rendiciones FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'logistica', 'crear'));

CREATE POLICY "Users with permission can update hoja_ruta_rendiciones"
ON public.hoja_ruta_rendiciones FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'logistica', 'editar'));

CREATE POLICY "Admin can manage hoja_ruta_rendiciones"
ON public.hoja_ruta_rendiciones FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_hoja_ruta_rendiciones_updated_at
BEFORE UPDATE ON public.hoja_ruta_rendiciones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();