-- Step 2: Migrate existing data
-- Convert 'confirmado' orders to 'preparado'
UPDATE pedidos SET estado = 'preparado' WHERE estado = 'confirmado';

-- Convert 'anulado' orders to 'rechazado'  
UPDATE pedidos SET estado = 'rechazado' WHERE estado = 'anulado';