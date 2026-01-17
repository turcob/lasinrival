-- Create enum for solicitud status
CREATE TYPE solicitud_descuento_estado AS ENUM ('pendiente', 'aprobada', 'rechazada', 'expirada', 'usada');

-- Create table for discount authorization requests
CREATE TABLE public.solicitudes_descuento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES auth.users(id),
  caja_id UUID REFERENCES public.cajas(id),
  producto_id UUID REFERENCES public.productos(id),
  porcentaje_solicitado NUMERIC NOT NULL,
  monto_venta NUMERIC NOT NULL DEFAULT 0,
  estado solicitud_descuento_estado NOT NULL DEFAULT 'pendiente',
  token VARCHAR(8) NOT NULL,
  token_usado BOOLEAN NOT NULL DEFAULT false,
  expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
  aprobado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solicitudes_descuento ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view their own requests
CREATE POLICY "Vendedores can view own requests"
ON public.solicitudes_descuento
FOR SELECT
USING (auth.uid() = vendedor_id);

-- Policy: Admins can view all requests
CREATE POLICY "Admins can view all requests"
ON public.solicitudes_descuento
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Authenticated users can create requests
CREATE POLICY "Authenticated can create requests"
ON public.solicitudes_descuento
FOR INSERT
WITH CHECK (auth.uid() = vendedor_id);

-- Policy: Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests"
ON public.solicitudes_descuento
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Vendedores can update their own requests (mark as used)
CREATE POLICY "Vendedores can update own requests"
ON public.solicitudes_descuento
FOR UPDATE
USING (auth.uid() = vendedor_id);

-- Create trigger for updated_at
CREATE TRIGGER update_solicitudes_descuento_updated_at
BEFORE UPDATE ON public.solicitudes_descuento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitudes_descuento;

-- Create index for faster queries
CREATE INDEX idx_solicitudes_descuento_estado ON public.solicitudes_descuento(estado);
CREATE INDEX idx_solicitudes_descuento_token ON public.solicitudes_descuento(token);
CREATE INDEX idx_solicitudes_descuento_vendedor ON public.solicitudes_descuento(vendedor_id);