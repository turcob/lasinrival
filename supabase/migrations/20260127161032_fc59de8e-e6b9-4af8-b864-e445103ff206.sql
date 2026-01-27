-- Política para permitir a usuarios con permiso POS insertar movimientos de inventario durante ventas
CREATE POLICY "Users with pos permission can insert movimientos_inventario" 
ON public.movimientos_inventario 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_permission(auth.uid(), 'pos'::text, 'crear'::app_permission)
);