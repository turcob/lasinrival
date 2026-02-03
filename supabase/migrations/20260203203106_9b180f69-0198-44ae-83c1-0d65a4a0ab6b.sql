-- Agregar política para que usuarios con permiso de logística puedan ver cobros y devoluciones de tablas legacy

-- Política para tabla cobros (legacy)
CREATE POLICY "Users with logistica permission can view cobros" 
ON public.cobros 
FOR SELECT 
USING (has_permission(auth.uid(), 'logistica', 'ver'));

-- Política para tabla devoluciones (legacy)  
CREATE POLICY "Users with logistica permission can view devoluciones" 
ON public.devoluciones 
FOR SELECT 
USING (has_permission(auth.uid(), 'logistica', 'ver'));