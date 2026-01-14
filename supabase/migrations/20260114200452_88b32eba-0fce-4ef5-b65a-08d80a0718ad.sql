-- Create table for arqueo details
CREATE TABLE public.arqueo_detalles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caja_id uuid NOT NULL REFERENCES public.cajas(id) ON DELETE CASCADE,
  denominacion integer NOT NULL,
  cantidad integer NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Create table for other payment methods in arqueo
CREATE TABLE public.arqueo_otros_medios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caja_id uuid NOT NULL REFERENCES public.cajas(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'posnet' or 'transferencias'
  monto numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.arqueo_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arqueo_otros_medios ENABLE ROW LEVEL SECURITY;

-- RLS Policies for arqueo_detalles
CREATE POLICY "Authenticated can view arqueo_detalles"
ON public.arqueo_detalles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert arqueo_detalles"
ON public.arqueo_detalles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for arqueo_otros_medios
CREATE POLICY "Authenticated can view arqueo_otros_medios"
ON public.arqueo_otros_medios
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert arqueo_otros_medios"
ON public.arqueo_otros_medios
FOR INSERT
TO authenticated
WITH CHECK (true);