
CREATE OR REPLACE FUNCTION public.generar_carga_items_hoja_ruta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'en_carga' AND (OLD.estado IS DISTINCT FROM 'en_carga') THEN
    INSERT INTO public.hoja_ruta_carga_items (
      hoja_ruta_id, pedido_id, producto_id, cantidad_esperada, estado
    )
    SELECT
      NEW.id,
      pd.pedido_id,
      pd.producto_id,
      SUM(pd.cantidad_pedida)::numeric,
      'pendiente'
    FROM public.hoja_ruta_paradas hrp
    JOIN public.pedido_detalles pd ON pd.pedido_id = hrp.pedido_id
    WHERE hrp.hoja_ruta_id = NEW.id
      AND pd.producto_id IS NOT NULL
    GROUP BY pd.pedido_id, pd.producto_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generar_carga_items ON public.hojas_ruta;
CREATE TRIGGER trg_generar_carga_items
AFTER UPDATE OF estado ON public.hojas_ruta
FOR EACH ROW
EXECUTE FUNCTION public.generar_carga_items_hoja_ruta();

-- Backfill
INSERT INTO public.hoja_ruta_carga_items (
  hoja_ruta_id, pedido_id, producto_id, cantidad_esperada, estado
)
SELECT
  hr.id, pd.pedido_id, pd.producto_id,
  SUM(pd.cantidad_pedida)::numeric, 'pendiente'
FROM public.hojas_ruta hr
JOIN public.hoja_ruta_paradas hrp ON hrp.hoja_ruta_id = hr.id
JOIN public.pedido_detalles pd ON pd.pedido_id = hrp.pedido_id
WHERE hr.estado = 'en_carga'
  AND pd.producto_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.hoja_ruta_carga_items i WHERE i.hoja_ruta_id = hr.id)
GROUP BY hr.id, pd.pedido_id, pd.producto_id;
