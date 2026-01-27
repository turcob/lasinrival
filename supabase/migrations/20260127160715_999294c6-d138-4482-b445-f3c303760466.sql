-- Política para permitir a vendedores registrar compras de empleados en cuenta corriente
CREATE POLICY "Users with pos permission can insert empleado_movimientos" 
ON public.empleado_movimientos 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_permission(auth.uid(), 'pos'::text, 'crear'::app_permission)
);