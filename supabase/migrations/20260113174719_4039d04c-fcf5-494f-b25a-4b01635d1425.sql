-- Enum para roles de usuario
CREATE TYPE public.app_role AS ENUM ('admin', 'encargado', 'cajero', 'vendedor', 'deposito');

-- Enum para permisos
CREATE TYPE public.app_permission AS ENUM ('ver', 'crear', 'editar', 'eliminar', 'anular', 'exportar');

-- Enum para estado de caja
CREATE TYPE public.cash_register_status AS ENUM ('abierta', 'cerrada');

-- Tabla de perfiles de usuario
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  estado BOOLEAN DEFAULT true,
  sucursal TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de roles de usuario (separada por seguridad)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Tabla de permisos por rol y módulo
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  modulo TEXT NOT NULL,
  permiso app_permission NOT NULL,
  UNIQUE (role, modulo, permiso)
);

-- Tabla de categorías (FAMILIA)
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_familia TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de subcategorías (GRUPO)
CREATE TABLE public.subcategorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_grupo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (categoria_id, codigo_grupo)
);

-- Tabla de productos
CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_articulo TEXT UNIQUE NOT NULL,
  descripcion TEXT NOT NULL,
  unidad_medida TEXT DEFAULT 'UN',
  categoria_id UUID REFERENCES public.categorias(id),
  subcategoria_id UUID REFERENCES public.subcategorias(id),
  codigo_barra TEXT,
  activo BOOLEAN DEFAULT true,
  stock_actual DECIMAL(12,2) DEFAULT 0,
  stock_minimo DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Listas de precios
CREATE TABLE public.listas_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Precios por producto y lista
CREATE TABLE public.precios_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES public.productos(id) ON DELETE CASCADE NOT NULL,
  lista_precio_id UUID REFERENCES public.listas_precios(id) ON DELETE CASCADE NOT NULL,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (producto_id, lista_precio_id)
);

-- Tabla de clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  dni_cuit TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  lista_precio_id UUID REFERENCES public.listas_precios(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Formas de pago
CREATE TABLE public.formas_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cajas registradoras
CREATE TABLE public.cajas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) NOT NULL,
  fecha_apertura TIMESTAMPTZ DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  fondo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado cash_register_status DEFAULT 'abierta',
  total_ventas DECIMAL(12,2) DEFAULT 0,
  total_egresos DECIMAL(12,2) DEFAULT 0,
  conteo_declarado DECIMAL(12,2),
  diferencia DECIMAL(12,2),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ventas
CREATE TABLE public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_comprobante SERIAL,
  caja_id UUID REFERENCES public.cajas(id),
  cliente_id UUID REFERENCES public.clientes(id),
  usuario_id UUID REFERENCES auth.users(id) NOT NULL,
  fecha TIMESTAMPTZ DEFAULT now(),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  descuento DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  anulada BOOLEAN DEFAULT false,
  anulada_por UUID REFERENCES auth.users(id),
  fecha_anulacion TIMESTAMPTZ,
  motivo_anulacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Detalle de ventas
CREATE TABLE public.venta_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES public.ventas(id) ON DELETE CASCADE NOT NULL,
  producto_id UUID REFERENCES public.productos(id) NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  descuento DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pagos de ventas (para pago mixto)
CREATE TABLE public.venta_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES public.ventas(id) ON DELETE CASCADE NOT NULL,
  forma_pago_id UUID REFERENCES public.formas_pago(id) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Movimientos de caja
CREATE TABLE public.movimientos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id UUID REFERENCES public.cajas(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  concepto TEXT NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  venta_id UUID REFERENCES public.ventas(id),
  usuario_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Movimientos de inventario
CREATE TABLE public.movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES public.productos(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad DECIMAL(12,2) NOT NULL,
  stock_anterior DECIMAL(12,2) NOT NULL,
  stock_nuevo DECIMAL(12,2) NOT NULL,
  motivo TEXT,
  venta_id UUID REFERENCES public.ventas(id),
  usuario_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auditoría de acciones
CREATE TABLE public.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id),
  accion TEXT NOT NULL,
  modulo TEXT NOT NULL,
  registro_id UUID,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formas_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Función para verificar roles (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Función para verificar cualquier rol
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Función para verificar permisos
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _modulo TEXT, _permiso app_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.modulo = _modulo
      AND rp.permiso = _permiso
  )
$$;

-- RLS Policies

-- Profiles: usuarios pueden ver todos, editar solo el suyo, admin puede todo
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User roles: solo admin puede gestionar
CREATE POLICY "Authenticated can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Role permissions: todos pueden ver, admin gestiona
CREATE POLICY "Authenticated can view permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage permissions" ON public.role_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Categorias: usuarios autenticados pueden ver, permisos por rol
CREATE POLICY "Authenticated can view categorias" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can insert categorias" ON public.categorias FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'categorias', 'crear'));
CREATE POLICY "Users with permission can update categorias" ON public.categorias FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'categorias', 'editar'));
CREATE POLICY "Users with permission can delete categorias" ON public.categorias FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'categorias', 'eliminar'));

-- Subcategorias
CREATE POLICY "Authenticated can view subcategorias" ON public.subcategorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can insert subcategorias" ON public.subcategorias FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'subcategorias', 'crear'));
CREATE POLICY "Users with permission can update subcategorias" ON public.subcategorias FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'subcategorias', 'editar'));
CREATE POLICY "Users with permission can delete subcategorias" ON public.subcategorias FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'subcategorias', 'eliminar'));

-- Productos
CREATE POLICY "Authenticated can view productos" ON public.productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can insert productos" ON public.productos FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'productos', 'crear'));
CREATE POLICY "Users with permission can update productos" ON public.productos FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'productos', 'editar'));
CREATE POLICY "Users with permission can delete productos" ON public.productos FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'productos', 'eliminar'));

-- Listas de precios
CREATE POLICY "Authenticated can view listas_precios" ON public.listas_precios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage listas_precios" ON public.listas_precios FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'precios', 'crear'));

-- Precios productos
CREATE POLICY "Authenticated can view precios" ON public.precios_productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage precios" ON public.precios_productos FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'precios', 'editar'));

-- Clientes
CREATE POLICY "Authenticated can view clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'clientes', 'crear'));
CREATE POLICY "Users with permission can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'clientes', 'editar'));
CREATE POLICY "Users with permission can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'clientes', 'eliminar'));

-- Formas de pago
CREATE POLICY "Authenticated can view formas_pago" ON public.formas_pago FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage formas_pago" ON public.formas_pago FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Cajas
CREATE POLICY "Authenticated can view cajas" ON public.cajas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage cajas" ON public.cajas FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'cajas', 'crear'));

-- Ventas
CREATE POLICY "Authenticated can view ventas" ON public.ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can insert ventas" ON public.ventas FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'ventas', 'crear'));
CREATE POLICY "Users with permission can update ventas" ON public.ventas FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'ventas', 'editar'));

-- Venta detalles
CREATE POLICY "Authenticated can view venta_detalles" ON public.venta_detalles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own venta_detalles" ON public.venta_detalles FOR ALL TO authenticated USING (true);

-- Venta pagos
CREATE POLICY "Authenticated can view venta_pagos" ON public.venta_pagos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage venta_pagos" ON public.venta_pagos FOR ALL TO authenticated USING (true);

-- Movimientos caja
CREATE POLICY "Authenticated can view movimientos_caja" ON public.movimientos_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert movimientos_caja" ON public.movimientos_caja FOR INSERT TO authenticated WITH CHECK (true);

-- Movimientos inventario
CREATE POLICY "Authenticated can view movimientos_inventario" ON public.movimientos_inventario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage inventario" ON public.movimientos_inventario FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'inventario', 'crear'));

-- Auditoria
CREATE POLICY "Authenticated can view auditoria" ON public.auditoria FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert auditoria" ON public.auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger para crear perfil al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categorias_updated_at BEFORE UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subcategorias_updated_at BEFORE UPDATE ON public.subcategorias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_precios_updated_at BEFORE UPDATE ON public.precios_productos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar datos iniciales
INSERT INTO public.formas_pago (nombre) VALUES 
('Efectivo'), ('Débito'), ('Crédito'), ('Transferencia'), ('QR');

INSERT INTO public.listas_precios (nombre) VALUES 
('Precio 1'), ('Precio 2');

-- Permisos por defecto para Admin (todos los permisos en todos los módulos)
INSERT INTO public.role_permissions (role, modulo, permiso)
SELECT 'admin'::app_role, m, p
FROM unnest(ARRAY['usuarios', 'roles', 'categorias', 'subcategorias', 'productos', 'clientes', 'ventas', 'cajas', 'inventario', 'reportes', 'precios']) AS m,
     unnest(ARRAY['ver', 'crear', 'editar', 'eliminar', 'anular', 'exportar']::app_permission[]) AS p;

-- Permisos para Encargado
INSERT INTO public.role_permissions (role, modulo, permiso)
SELECT 'encargado'::app_role, m, p
FROM unnest(ARRAY['categorias', 'subcategorias', 'productos', 'clientes', 'ventas', 'cajas', 'inventario', 'reportes', 'precios']) AS m,
     unnest(ARRAY['ver', 'crear', 'editar', 'eliminar', 'exportar']::app_permission[]) AS p;

-- Permisos para Cajero
INSERT INTO public.role_permissions (role, modulo, permiso) VALUES
('cajero', 'productos', 'ver'),
('cajero', 'clientes', 'ver'),
('cajero', 'clientes', 'crear'),
('cajero', 'ventas', 'ver'),
('cajero', 'ventas', 'crear'),
('cajero', 'cajas', 'ver'),
('cajero', 'cajas', 'crear');

-- Permisos para Vendedor
INSERT INTO public.role_permissions (role, modulo, permiso) VALUES
('vendedor', 'productos', 'ver'),
('vendedor', 'clientes', 'ver'),
('vendedor', 'clientes', 'crear'),
('vendedor', 'ventas', 'ver'),
('vendedor', 'ventas', 'crear');

-- Permisos para Depósito
INSERT INTO public.role_permissions (role, modulo, permiso) VALUES
('deposito', 'productos', 'ver'),
('deposito', 'inventario', 'ver'),
('deposito', 'inventario', 'crear'),
('deposito', 'inventario', 'editar');