-- 1. Crear tabla de roles personalizables
CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  color TEXT DEFAULT 'bg-gray-100 text-gray-800',
  es_sistema BOOLEAN DEFAULT false, -- Roles del sistema no se pueden eliminar
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Insertar roles existentes del enum
INSERT INTO public.roles (codigo, nombre, descripcion, color, es_sistema, orden) VALUES
  ('admin', 'Administrador', 'Acceso completo a todas las funciones del sistema', 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', true, 0),
  ('encargado', 'Encargado', 'Gestión de ventas, inventario y reportes', 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', true, 1),
  ('cajero', 'Cajero', 'Operaciones de caja y ventas', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', true, 2),
  ('vendedor', 'Vendedor', 'Registro de ventas y consultas', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', true, 3),
  ('deposito', 'Depósito', 'Gestión de inventario y stock', 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', true, 4);

-- 3. Habilitar RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
CREATE POLICY "Authenticated can view roles"
ON public.roles FOR SELECT
USING (true);

CREATE POLICY "Admin can manage roles"
ON public.roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Agregar columna rol_codigo a user_roles (para transición gradual)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS rol_codigo TEXT;

-- 6. Actualizar user_roles con el código del rol
UPDATE public.user_roles SET rol_codigo = role::text WHERE rol_codigo IS NULL;

-- 7. Agregar columna rol_codigo a role_permissions  
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS rol_codigo TEXT;

-- 8. Actualizar role_permissions con el código del rol
UPDATE public.role_permissions SET rol_codigo = role::text WHERE rol_codigo IS NULL;

-- 9. Agregar columna rol_codigo a configuracion_descuentos
ALTER TABLE public.configuracion_descuentos ADD COLUMN IF NOT EXISTS rol_codigo TEXT;

-- 10. Actualizar configuracion_descuentos con el código del rol
UPDATE public.configuracion_descuentos SET rol_codigo = role WHERE rol_codigo IS NULL;

-- 11. Trigger para updated_at
CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentarios
COMMENT ON TABLE public.roles IS 'Tabla de roles personalizables del sistema';
COMMENT ON COLUMN public.roles.codigo IS 'Código único del rol usado internamente';
COMMENT ON COLUMN public.roles.es_sistema IS 'Los roles del sistema no pueden ser eliminados';