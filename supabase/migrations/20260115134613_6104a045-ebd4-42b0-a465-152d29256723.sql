-- Eliminar los constraints/índices incorrectos
ALTER TABLE lista_precio_porcentajes DROP CONSTRAINT IF EXISTS unique_lista_general;
ALTER TABLE lista_precio_porcentajes DROP CONSTRAINT IF EXISTS unique_lista_marca;
ALTER TABLE lista_precio_porcentajes DROP CONSTRAINT IF EXISTS unique_lista_tipo;

-- Crear índices parciales correctos
-- Solo puede haber UN registro general por lista
CREATE UNIQUE INDEX unique_lista_general ON lista_precio_porcentajes (lista_precio_id) WHERE es_general = true;

-- Solo puede haber UN registro por marca por lista (cuando marca_id no es null)
CREATE UNIQUE INDEX unique_lista_marca ON lista_precio_porcentajes (lista_precio_id, marca_id) WHERE marca_id IS NOT NULL;

-- Solo puede haber UN registro por tipo por lista (cuando tipo_producto_id no es null)
CREATE UNIQUE INDEX unique_lista_tipo ON lista_precio_porcentajes (lista_precio_id, tipo_producto_id) WHERE tipo_producto_id IS NOT NULL;