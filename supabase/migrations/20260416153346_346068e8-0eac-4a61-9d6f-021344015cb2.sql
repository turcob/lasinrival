
CREATE TABLE IF NOT EXISTS public.vendedor_zonas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  zona_id UUID NOT NULL REFERENCES public.zonas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, zona_id)
);

ALTER TABLE public.vendedor_zonas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vendedor_zonas"
  ON public.vendedor_zonas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users with permission can insert vendedor_zonas"
  ON public.vendedor_zonas FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'ventas', 'crear'));

CREATE POLICY "Users with permission can delete vendedor_zonas"
  ON public.vendedor_zonas FOR DELETE TO authenticated
  USING (has_permission(auth.uid(), 'ventas', 'crear'));
