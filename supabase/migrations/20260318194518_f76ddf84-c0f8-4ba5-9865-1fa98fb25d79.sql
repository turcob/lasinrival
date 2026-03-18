CREATE OR REPLACE VIEW public.cliente_saldos AS
SELECT cliente_id,
    COALESCE(sum(
        CASE
            WHEN tipo = ANY (ARRAY['compra'::text, 'saldo_inicial'::text, 'nota_debito'::text]) THEN monto
            ELSE 0::numeric
        END), 0::numeric) AS total_deuda,
    COALESCE(sum(
        CASE
            WHEN tipo = ANY (ARRAY['pago'::text, 'nota_credito'::text, 'devolucion'::text, 'anulacion'::text]) THEN monto
            ELSE 0::numeric
        END), 0::numeric) AS total_pagado,
    COALESCE(sum(
        CASE
            WHEN tipo = ANY (ARRAY['compra'::text, 'saldo_inicial'::text, 'nota_debito'::text]) THEN monto
            ELSE - monto
        END), 0::numeric) AS saldo_actual
   FROM cliente_movimientos
  WHERE COALESCE(origen, 'sistema'::text) <> 'historico'::text
  GROUP BY cliente_id;