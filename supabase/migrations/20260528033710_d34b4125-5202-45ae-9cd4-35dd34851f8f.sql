CREATE OR REPLACE FUNCTION public.import_localidades_clientes(p_data jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH src AS (
    SELECT (elem->>0) AS codigo, (elem->>1) AS localidad
    FROM jsonb_array_elements(p_data) AS elem
  ),
  upd AS (
    UPDATE public.clientes c
    SET localidad = s.localidad
    FROM src s
    WHERE c.codigo_cliente = s.codigo
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_localidades_clientes(jsonb) TO authenticated, service_role;