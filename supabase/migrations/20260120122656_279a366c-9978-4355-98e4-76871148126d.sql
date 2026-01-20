-- Agregar campos para el flujo de confirmación de arqueo
ALTER TABLE public.cajas 
ADD COLUMN arqueo_confirmado boolean DEFAULT false,
ADD COLUMN arqueo_pendiente_revision boolean DEFAULT false,
ADD COLUMN confirmado_por uuid REFERENCES auth.users(id),
ADD COLUMN fecha_confirmacion timestamp with time zone;

-- Actualizar cajas cerradas existentes como confirmadas automáticamente
UPDATE public.cajas 
SET arqueo_confirmado = true 
WHERE estado = 'cerrada';

-- Agregar políticas para que los usuarios puedan actualizar sus propios arqueos (cuando no están confirmados)
-- y los admins puedan confirmarlos

-- Permitir UPDATE de arqueo_detalles
CREATE POLICY "Users can update own arqueo_detalles"
ON public.arqueo_detalles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM cajas 
    WHERE cajas.id = arqueo_detalles.caja_id 
    AND cajas.usuario_id = auth.uid()
    AND cajas.arqueo_confirmado = false
  )
);

CREATE POLICY "Users can delete own arqueo_detalles"
ON public.arqueo_detalles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM cajas 
    WHERE cajas.id = arqueo_detalles.caja_id 
    AND cajas.usuario_id = auth.uid()
    AND cajas.arqueo_confirmado = false
  )
);

-- Permitir UPDATE de arqueo_otros_medios
CREATE POLICY "Users can update own arqueo_otros_medios"
ON public.arqueo_otros_medios
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM cajas 
    WHERE cajas.id = arqueo_otros_medios.caja_id 
    AND cajas.usuario_id = auth.uid()
    AND cajas.arqueo_confirmado = false
  )
);

CREATE POLICY "Users can delete own arqueo_otros_medios"
ON public.arqueo_otros_medios
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM cajas 
    WHERE cajas.id = arqueo_otros_medios.caja_id 
    AND cajas.usuario_id = auth.uid()
    AND cajas.arqueo_confirmado = false
  )
);