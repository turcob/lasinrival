
-- Ampliar comprobantes_afip
ALTER TABLE public.comprobantes_afip
  ADD COLUMN IF NOT EXISTS motivo_nc text,
  ADD COLUMN IF NOT EXISTS observaciones text,
  ADD COLUMN IF NOT EXISTS tipo_nc text,
  ADD COLUMN IF NOT EXISTS factura_origen_id uuid REFERENCES public.comprobantes_afip(id);

CREATE INDEX IF NOT EXISTS idx_comprobantes_factura_origen ON public.comprobantes_afip(factura_origen_id);

-- Ampliar ventas
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS monto_acreditado numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acreditada_parcial boolean NOT NULL DEFAULT false;

-- Nueva tabla nota_credito_items
CREATE TABLE IF NOT EXISTS public.nota_credito_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comprobante_nc_id uuid NOT NULL REFERENCES public.comprobantes_afip(id) ON DELETE CASCADE,
  comprobante_factura_id uuid NOT NULL REFERENCES public.comprobantes_afip(id),
  venta_detalle_id uuid REFERENCES public.venta_detalles(id),
  producto_id uuid REFERENCES public.productos(id),
  descripcion text,
  cantidad numeric(12,2) NOT NULL DEFAULT 0,
  precio_unitario numeric(12,2) NOT NULL DEFAULT 0,
  importe numeric(12,2) NOT NULL DEFAULT 0,
  reingresado_stock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_credito_items TO authenticated;
GRANT ALL ON public.nota_credito_items TO service_role;

ALTER TABLE public.nota_credito_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with permission can view NC items"
  ON public.nota_credito_items FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'facturacion'::text, 'ver'::public.app_permission));

CREATE POLICY "Users with permission can insert NC items"
  ON public.nota_credito_items FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'facturacion'::text, 'crear'::public.app_permission));

CREATE INDEX IF NOT EXISTS idx_nci_factura ON public.nota_credito_items(comprobante_factura_id);
CREATE INDEX IF NOT EXISTS idx_nci_nc ON public.nota_credito_items(comprobante_nc_id);
CREATE INDEX IF NOT EXISTS idx_nci_detalle ON public.nota_credito_items(venta_detalle_id);

-- RPC: saldo disponible para acreditar de una factura
CREATE OR REPLACE FUNCTION public.get_factura_saldo_disponible(p_factura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura record;
  v_venta_id uuid;
  v_items jsonb;
  v_total_factura numeric;
  v_total_acreditado numeric;
BEGIN
  SELECT * INTO v_factura FROM public.comprobantes_afip WHERE id = p_factura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  v_venta_id := v_factura.venta_id;
  v_total_factura := COALESCE(v_factura.importe_total, 0);

  -- Total acreditado mediante NCs parciales o totales vinculadas a esta factura
  SELECT COALESCE(SUM(importe_total), 0) INTO v_total_acreditado
  FROM public.comprobantes_afip
  WHERE factura_origen_id = p_factura_id
    AND tipo_comprobante IN (3, 8, 13);

  IF v_venta_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'venta_detalle_id', vd.id,
      'producto_id', vd.producto_id,
      'descripcion', COALESCE(p.descripcion, vd.producto_temporal_nombre, 'Producto'),
      'cantidad_facturada', vd.cantidad,
      'precio_unitario', vd.precio_unitario,
      'descuento_porcentaje', COALESCE(vd.descuento_porcentaje, 0),
      'cantidad_acreditada', COALESCE((
        SELECT SUM(nci.cantidad)
        FROM public.nota_credito_items nci
        WHERE nci.venta_detalle_id = vd.id
      ), 0),
      'cantidad_disponible', vd.cantidad - COALESCE((
        SELECT SUM(nci.cantidad)
        FROM public.nota_credito_items nci
        WHERE nci.venta_detalle_id = vd.id
      ), 0)
    )), '[]'::jsonb)
    INTO v_items
    FROM public.venta_detalles vd
    LEFT JOIN public.productos p ON p.id = vd.producto_id
    WHERE vd.venta_id = v_venta_id;
  ELSE
    v_items := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'factura_id', p_factura_id,
    'venta_id', v_venta_id,
    'total_factura', v_total_factura,
    'total_acreditado', v_total_acreditado,
    'monto_disponible', GREATEST(v_total_factura - v_total_acreditado, 0),
    'items', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_factura_saldo_disponible(uuid) TO authenticated;
