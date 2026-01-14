-- Eliminar en orden correcto por dependencias de foreign keys
-- Primero los pagos de ventas
DELETE FROM venta_pagos;

-- Detalles de ventas
DELETE FROM venta_detalles;

-- Movimientos de inventario
DELETE FROM movimientos_inventario;

-- Movimientos de caja (que referencian ventas)
DELETE FROM movimientos_caja;

-- Las ventas
DELETE FROM ventas;

-- Productos
DELETE FROM productos;

-- Subcategorías
DELETE FROM subcategorias;

-- Categorías
DELETE FROM categorias;