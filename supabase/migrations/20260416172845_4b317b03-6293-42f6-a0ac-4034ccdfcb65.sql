
-- Tabla de horarios/turnos por zona
CREATE TABLE public.zona_horarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zona_id UUID NOT NULL REFERENCES public.zonas(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrega', 'pedido')),
  turno_nombre TEXT NOT NULL DEFAULT 'General',
  hora_desde TIME,
  hora_hasta TIME,
  capacidad_maxima INTEGER DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(zona_id, dia_semana, tipo, turno_nombre)
);

-- Enable RLS
ALTER TABLE public.zona_horarios ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated can view zona_horarios"
ON public.zona_horarios
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage zona_horarios"
ON public.zona_horarios
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_zona_horarios_updated_at
BEFORE UPDATE ON public.zona_horarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
