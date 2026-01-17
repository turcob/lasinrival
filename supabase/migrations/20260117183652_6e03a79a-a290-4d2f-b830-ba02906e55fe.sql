-- Update existing expired requests to 'expirada' status
UPDATE solicitudes_descuento 
SET estado = 'expirada', updated_at = NOW()
WHERE estado = 'pendiente' 
AND expira_en < NOW();

-- Create function to auto-expire old requests (can be called periodically)
CREATE OR REPLACE FUNCTION public.auto_expire_solicitudes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE solicitudes_descuento 
  SET estado = 'expirada', updated_at = NOW()
  WHERE estado = 'pendiente' 
  AND expira_en < NOW();
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;