-- Eliminar tabla actual de listas_precios (primero las foreign keys)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_lista_precio_id_fkey;

-- Eliminar tabla anterior
DROP TABLE IF EXISTS listas_precios CASCADE;

-- Crear nueva tabla de listas de precios (simplificada)
CREATE TABLE public.listas_precios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de matriz de porcentajes
CREATE TABLE public.lista_precio_porcentajes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_precio_id UUID NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
  marca_id UUID REFERENCES marcas(id) ON DELETE CASCADE,
  tipo_producto_id UUID REFERENCES tipos_producto(id) ON DELETE CASCADE,
  es_general BOOLEAN DEFAULT FALSE,
  porcentaje NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Solo uno de los tres puede tener valor
  CONSTRAINT check_single_reference CHECK (
    (marca_id IS NOT NULL AND tipo_producto_id IS NULL AND es_general = FALSE) OR
    (marca_id IS NULL AND tipo_producto_id IS NOT NULL AND es_general = FALSE) OR
    (marca_id IS NULL AND tipo_producto_id IS NULL AND es_general = TRUE)
  ),
  -- Unicidad por combinación
  CONSTRAINT unique_lista_marca UNIQUE (lista_precio_id, marca_id) DEFERRABLE,
  CONSTRAINT unique_lista_tipo UNIQUE (lista_precio_id, tipo_producto_id) DEFERRABLE,
  CONSTRAINT unique_lista_general UNIQUE (lista_precio_id, es_general) DEFERRABLE
);

-- Crear tabla de excepciones por producto
CREATE TABLE public.lista_precio_excepciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_precio_id UUID REFERENCES listas_precios(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  porcentaje NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Un producto solo puede tener una excepción por lista (o global)
  CONSTRAINT unique_excepcion UNIQUE (lista_precio_id, producto_id)
);

-- Recrear foreign key en clientes
ALTER TABLE clientes 
ADD CONSTRAINT clientes_lista_precio_id_fkey 
FOREIGN KEY (lista_precio_id) REFERENCES listas_precios(id) ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE listas_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_precio_porcentajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_precio_excepciones ENABLE ROW LEVEL SECURITY;

-- Políticas para listas_precios
CREATE POLICY "Authenticated can view listas_precios" 
ON listas_precios FOR SELECT USING (true);

CREATE POLICY "Users with permission can manage listas_precios" 
ON listas_precios FOR ALL 
USING (has_permission(auth.uid(), 'precios', 'crear'));

-- Políticas para lista_precio_porcentajes
CREATE POLICY "Authenticated can view lista_precio_porcentajes" 
ON lista_precio_porcentajes FOR SELECT USING (true);

CREATE POLICY "Users with permission can manage lista_precio_porcentajes" 
ON lista_precio_porcentajes FOR ALL 
USING (has_permission(auth.uid(), 'precios', 'crear'));

-- Políticas para lista_precio_excepciones
CREATE POLICY "Authenticated can view lista_precio_excepciones" 
ON lista_precio_excepciones FOR SELECT USING (true);

CREATE POLICY "Users with permission can manage lista_precio_excepciones" 
ON lista_precio_excepciones FOR ALL 
USING (has_permission(auth.uid(), 'precios', 'crear'));

-- Insertar lista por defecto
INSERT INTO listas_precios (nombre, codigo, orden) VALUES 
('MINORISTA', '1', 1),
('MAYORISTA', '2', 2);