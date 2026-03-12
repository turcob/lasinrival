
-- Proveedores table
CREATE TABLE public.proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_proveedor text NOT NULL,
  razon_social text NOT NULL,
  contacto text,
  telefono text,
  email text,
  direccion text,
  cuit text,
  condicion_iva text,
  activo boolean DEFAULT true,
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view proveedores" ON public.proveedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can insert proveedores" ON public.proveedores FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'proveedores'::text, 'crear'::app_permission));
CREATE POLICY "Users with permission can update proveedores" ON public.proveedores FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'proveedores'::text, 'editar'::app_permission));
CREATE POLICY "Users with permission can delete proveedores" ON public.proveedores FOR DELETE TO authenticated USING (has_permission(auth.uid(), 'proveedores'::text, 'eliminar'::app_permission));
CREATE POLICY "Admin can manage proveedores" ON public.proveedores FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Proveedor movimientos (cuenta corriente)
CREATE TYPE public.proveedor_movimiento_tipo AS ENUM ('factura', 'pago', 'nota_credito', 'nota_debito', 'ajuste');

CREATE TABLE public.proveedor_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  tipo proveedor_movimiento_tipo NOT NULL,
  numero_comprobante text,
  tipo_comprobante text,
  fecha_emision date,
  fecha_vencimiento date,
  monto numeric NOT NULL DEFAULT 0,
  saldo_pendiente numeric NOT NULL DEFAULT 0,
  concepto text,
  forma_pago_id uuid REFERENCES public.formas_pago(id),
  usuario_registro_id uuid NOT NULL,
  observaciones text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.proveedor_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view proveedor_movimientos" ON public.proveedor_movimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can insert proveedor_movimientos" ON public.proveedor_movimientos FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'proveedores'::text, 'crear'::app_permission));
CREATE POLICY "Users with permission can update proveedor_movimientos" ON public.proveedor_movimientos FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'proveedores'::text, 'editar'::app_permission));
CREATE POLICY "Users with permission can delete proveedor_movimientos" ON public.proveedor_movimientos FOR DELETE TO authenticated USING (has_permission(auth.uid(), 'proveedores'::text, 'eliminar'::app_permission));
CREATE POLICY "Admin can manage proveedor_movimientos" ON public.proveedor_movimientos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Ordenes de compra
CREATE TYPE public.orden_compra_estado AS ENUM ('borrador', 'confirmada', 'parcial', 'recibida', 'anulada');

CREATE TABLE public.ordenes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_orden integer NOT NULL GENERATED ALWAYS AS IDENTITY,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id),
  estado orden_compra_estado NOT NULL DEFAULT 'borrador',
  fecha_orden timestamptz NOT NULL DEFAULT now(),
  fecha_entrega_estimada date,
  fecha_recepcion timestamptz,
  subtotal numeric NOT NULL DEFAULT 0,
  descuento numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  observaciones text,
  usuario_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ordenes_compra" ON public.ordenes_compra FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can insert ordenes_compra" ON public.ordenes_compra FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'proveedores'::text, 'crear'::app_permission));
CREATE POLICY "Users with permission can update ordenes_compra" ON public.ordenes_compra FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'proveedores'::text, 'editar'::app_permission));
CREATE POLICY "Admin can manage ordenes_compra" ON public.ordenes_compra FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Orden compra detalles
CREATE TABLE public.orden_compra_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id uuid NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.productos(id),
  descripcion text,
  cantidad numeric NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  cantidad_recibida numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.orden_compra_detalles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view orden_compra_detalles" ON public.orden_compra_detalles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage orden_compra_detalles" ON public.orden_compra_detalles FOR ALL TO authenticated USING (has_permission(auth.uid(), 'proveedores'::text, 'crear'::app_permission));
CREATE POLICY "Admin can manage orden_compra_detalles" ON public.orden_compra_detalles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
