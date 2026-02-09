
ALTER TABLE productos ADD COLUMN es_frio boolean NOT NULL DEFAULT false;

-- Marcar como frios los productos de categorias frias existentes
UPDATE productos p
SET es_frio = true
FROM categorias c
WHERE p.categoria_id = c.id
AND c.codigo_familia IN ('01', '02', '05', '09');
