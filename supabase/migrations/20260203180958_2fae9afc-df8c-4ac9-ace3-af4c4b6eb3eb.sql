-- Step 1: Add 'rechazado' to pedido_estado enum
ALTER TYPE pedido_estado ADD VALUE IF NOT EXISTS 'rechazado';