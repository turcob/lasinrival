
-- 1. Agregar columnas de auditoría de confirmación de carga
ALTER TABLE public.hojas_ruta
  ADD COLUMN IF NOT EXISTS carga_confirmada_at timestamptz,
  ADD COLUMN IF NOT EXISTS carga_confirmada_por uuid,
  ADD COLUMN IF NOT EXISTS carga_forzada boolean NOT NULL DEFAULT false;

-- 2. Crear tabla de items de carga (checklist por producto)
CREATE TABLE IF NOT EXISTS public.hoja_ruta_carga_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_ruta_id uuid NOT NULL REFERENCES public.hojas_ruta(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad_esperada numeric NOT NULL DEFAULT 0,
  cantidad_cargada numeric,
  estado text NOT NULL DEFAULT 'pendiente', -- pendiente | ok | faltante | sobrante
  observaciones text,
  verificado_por uuid,
  verificado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carga_items_hoja ON public.hoja_ruta_carga_items(hoja_ruta_id);
CREATE INDEX IF NOT EXISTS idx_carga_items_pedido ON public.hoja_ruta_carga_items(pedido_id);

ALTER TABLE public.hoja_ruta_carga_items ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_carga_items_updated_at ON public.hoja_ruta_carga_items;
CREATE TRIGGER trg_carga_items_updated_at
BEFORE UPDATE ON public.hoja_ruta_carga_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Función para verificar si el usuario es responsable de la hoja
CREATE OR REPLACE FUNCTION public.is_route_responsable(route_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.hojas_ruta hr
    JOIN public.empleados e ON hr.responsable_id = e.id
    WHERE hr.id = route_id
      AND e.user_id = auth.uid()
  );
END;
$$;

-- 4. RLS para carga_items
DROP POLICY IF EXISTS "Authenticated can view carga_items" ON public.hoja_ruta_carga_items;
CREATE POLICY "Authenticated can view carga_items"
  ON public.hoja_ruta_carga_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Responsable manages carga_items en_carga" ON public.hoja_ruta_carga_items;
CREATE POLICY "Responsable manages carga_items en_carga"
  ON public.hoja_ruta_carga_items FOR ALL
  TO authenticated
  USING (
    is_route_responsable(hoja_ruta_id)
    AND EXISTS (SELECT 1 FROM hojas_ruta WHERE id = hoja_ruta_id AND estado = 'en_carga')
  )
  WITH CHECK (
    is_route_responsable(hoja_ruta_id)
    AND EXISTS (SELECT 1 FROM hojas_ruta WHERE id = hoja_ruta_id AND estado = 'en_carga')
  );

DROP POLICY IF EXISTS "Logistica manages carga_items" ON public.hoja_ruta_carga_items;
CREATE POLICY "Logistica manages carga_items"
  ON public.hoja_ruta_carga_items FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), 'logistica', 'editar'))
  WITH CHECK (has_permission(auth.uid(), 'logistica', 'editar'));

-- 5. Actualizar política de paradas: chofer solo ve paradas si la hoja está en_ruta o completada
DROP POLICY IF EXISTS "Choferes ven paradas de sus rutas" ON public.hoja_ruta_paradas;
CREATE POLICY "Choferes ven paradas de sus rutas"
  ON public.hoja_ruta_paradas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hojas_ruta hr
      JOIN empleados e ON hr.chofer_id = e.id
      WHERE hr.id = hoja_ruta_paradas.hoja_ruta_id
        AND e.user_id = auth.uid()
        AND hr.estado IN ('en_ruta', 'completada')
    )
  );

DROP POLICY IF EXISTS "Choferes actualizan paradas" ON public.hoja_ruta_paradas;
CREATE POLICY "Choferes actualizan paradas"
  ON public.hoja_ruta_paradas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM hojas_ruta hr
      JOIN empleados e ON hr.chofer_id = e.id
      WHERE hr.id = hoja_ruta_paradas.hoja_ruta_id
        AND e.user_id = auth.uid()
        AND hr.estado = 'en_ruta'
    )
  );
