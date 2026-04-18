-- Trigger para marcar automáticamente como 'web' los pedidos que llegan desde Paladini
CREATE OR REPLACE FUNCTION public.set_tipo_pedido_paladini()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.observaciones IS NOT NULL AND NEW.observaciones LIKE 'Pedido Paladini%' THEN
    NEW.tipo_pedido := 'web';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tipo_pedido_paladini ON public.pedidos;
CREATE TRIGGER trg_set_tipo_pedido_paladini
BEFORE INSERT OR UPDATE OF observaciones ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_tipo_pedido_paladini();

-- Backfill: corregir pedidos existentes de Paladini que están marcados como 'reparto'
UPDATE public.pedidos
SET tipo_pedido = 'web'
WHERE observaciones LIKE 'Pedido Paladini%'
  AND tipo_pedido <> 'web';