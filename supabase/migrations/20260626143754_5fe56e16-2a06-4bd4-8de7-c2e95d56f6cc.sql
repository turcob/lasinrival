CREATE POLICY "Users with permission can update comprobantes"
ON public.comprobantes_afip
FOR UPDATE
USING (public.has_permission(auth.uid(), 'facturacion'::text, 'editar'::public.app_permission))
WITH CHECK (public.has_permission(auth.uid(), 'facturacion'::text, 'editar'::public.app_permission));