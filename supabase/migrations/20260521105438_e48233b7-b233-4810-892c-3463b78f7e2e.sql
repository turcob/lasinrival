
-- Devoluciones del vendedor (descuento manual aplicado al cobro)
CREATE TABLE public.hoja_ruta_devoluciones_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_ruta_id uuid NOT NULL,
  parada_id uuid NOT NULL,
  monto numeric NOT NULL CHECK (monto > 0),
  descripcion text NOT NULL,
  usuario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dev_vendedor_hr ON public.hoja_ruta_devoluciones_vendedor(hoja_ruta_id);
CREATE INDEX idx_dev_vendedor_parada ON public.hoja_ruta_devoluciones_vendedor(parada_id);

ALTER TABLE public.hoja_ruta_devoluciones_vendedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view devoluciones_vendedor"
ON public.hoja_ruta_devoluciones_vendedor FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Choferes pueden insertar devoluciones vendedor"
ON public.hoja_ruta_devoluciones_vendedor FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id AND is_stop_owner(parada_id));

CREATE POLICY "Logistica puede administrar devoluciones vendedor"
ON public.hoja_ruta_devoluciones_vendedor FOR ALL
TO authenticated
USING (has_permission(auth.uid(), 'logistica', 'editar'::app_permission))
WITH CHECK (has_permission(auth.uid(), 'logistica', 'editar'::app_permission));

-- Ventas de stock rechazado realizadas durante la ruta
CREATE TABLE public.hoja_ruta_ventas_rechazados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_ruta_id uuid NOT NULL,
  parada_id uuid NOT NULL,           -- parada del cliente comprador
  cliente_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL DEFAULT 0,
  monto_total numeric NOT NULL DEFAULT 0,
  forma_pago_id uuid NOT NULL,
  cobro_id uuid,
  observaciones text,
  usuario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vrech_hr ON public.hoja_ruta_ventas_rechazados(hoja_ruta_id);
CREATE INDEX idx_vrech_parada ON public.hoja_ruta_ventas_rechazados(parada_id);
CREATE INDEX idx_vrech_producto ON public.hoja_ruta_ventas_rechazados(producto_id);

ALTER TABLE public.hoja_ruta_ventas_rechazados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ventas_rechazados"
ON public.hoja_ruta_ventas_rechazados FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Choferes pueden insertar ventas rechazados"
ON public.hoja_ruta_ventas_rechazados FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id AND is_stop_owner(parada_id));

CREATE POLICY "Logistica puede administrar ventas rechazados"
ON public.hoja_ruta_ventas_rechazados FOR ALL
TO authenticated
USING (has_permission(auth.uid(), 'logistica', 'editar'::app_permission))
WITH CHECK (has_permission(auth.uid(), 'logistica', 'editar'::app_permission));
