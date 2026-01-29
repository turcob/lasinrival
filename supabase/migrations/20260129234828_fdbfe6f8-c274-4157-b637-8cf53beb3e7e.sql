-- Crear tabla para almacenar sugerencias de usuarios
CREATE TABLE public.sugerencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  contenido TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  respuesta TEXT,
  respondido_por UUID,
  fecha_respuesta TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.sugerencias ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden crear sugerencias
CREATE POLICY "Users can create sugerencias"
ON public.sugerencias
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- Usuarios pueden ver sus propias sugerencias
CREATE POLICY "Users can view own sugerencias"
ON public.sugerencias
FOR SELECT
USING (auth.uid() = usuario_id);

-- Admins pueden ver todas las sugerencias
CREATE POLICY "Admins can view all sugerencias"
ON public.sugerencias
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins pueden actualizar sugerencias (para responder)
CREATE POLICY "Admins can update sugerencias"
ON public.sugerencias
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_sugerencias_updated_at
BEFORE UPDATE ON public.sugerencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();