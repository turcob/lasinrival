-- Drop and recreate the cliente_saldos view to include saldo_inicial type
DROP VIEW IF EXISTS cliente_saldos;

CREATE VIEW cliente_saldos AS
SELECT 
    cliente_id,
    COALESCE(sum(
        CASE
            WHEN tipo IN ('compra', 'saldo_inicial', 'nota_debito') THEN monto
            ELSE 0::numeric
        END), 0::numeric) AS total_deuda,
    COALESCE(sum(
        CASE
            WHEN tipo IN ('pago', 'nota_credito', 'devolucion') THEN monto
            ELSE 0::numeric
        END), 0::numeric) AS total_pagado,
    COALESCE(sum(
        CASE
            WHEN tipo IN ('compra', 'saldo_inicial', 'nota_debito') THEN monto
            ELSE -monto
        END), 0::numeric) AS saldo_actual
FROM cliente_movimientos
GROUP BY cliente_id;