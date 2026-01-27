-- Eliminar las políticas restrictivas actuales
DROP POLICY IF EXISTS "Users with pos permission can insert empleado_movimientos" ON public.empleado_movimientos;
DROP POLICY IF EXISTS "Users with pos permission can insert movimientos_inventario" ON public.movimientos_inventario;

-- Recrear como políticas PERMISSIVE (usando YES explícitamente)
CREATE POLICY "POS users can insert empleado_movimientos" 
ON public.empleado_movimientos 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_permission(auth.uid(), 'pos'::text, 'crear'::app_permission)
);

CREATE POLICY "POS users can insert movimientos_inventario" 
ON public.movimientos_inventario 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_permission(auth.uid(), 'pos'::text, 'crear'::app_permission)
);