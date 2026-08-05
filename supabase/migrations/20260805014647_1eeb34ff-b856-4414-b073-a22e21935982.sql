CREATE TABLE public.lista_precio_escalas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_precio_id uuid NULL REFERENCES public.listas_precios(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  cantidad_desde integer NOT NULL,
  precio_unitario numeric NULL,
  porcentaje numeric NULL,
  descripcion text NULL,
  fecha_inicio date NULL,
  fecha_fin date NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lista_precio_escalas_cantidad_valida CHECK (cantidad_desde > 1),
  CONSTRAINT lista_precio_escalas_valor_valido CHECK (precio_unitario IS NOT NULL OR porcentaje IS NOT NULL)
);

CREATE UNIQUE INDEX lista_precio_escalas_unicas
  ON public.lista_precio_escalas (COALESCE(lista_precio_id, '00000000-0000-0000-0000-000000000000'::uuid), producto_id, cantidad_desde);

CREATE INDEX lista_precio_escalas_producto_idx ON public.lista_precio_escalas (producto_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lista_precio_escalas TO authenticated;
GRANT SELECT ON public.lista_precio_escalas TO anon;
GRANT ALL ON public.lista_precio_escalas TO service_role;

ALTER TABLE public.lista_precio_escalas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lista_precio_escalas"
  ON public.lista_precio_escalas FOR SELECT USING (true);

CREATE POLICY "Users with permission can manage lista_precio_escalas"
  ON public.lista_precio_escalas FOR ALL
  USING (has_permission(auth.uid(), 'precios'::text, 'crear'::app_permission))
  WITH CHECK (has_permission(auth.uid(), 'precios'::text, 'crear'::app_permission));

CREATE TRIGGER update_lista_precio_escalas_updated_at
  BEFORE UPDATE ON public.lista_precio_escalas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS empaque_de_producto_id uuid NULL REFERENCES public.productos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS productos_empaque_de_idx ON public.productos (empaque_de_producto_id);

ALTER TABLE public.configuracion_comercio
  ADD COLUMN IF NOT EXISTS tolerancia_precio_empaque numeric NOT NULL DEFAULT 1;