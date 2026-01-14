-- Add AFIP environment mode column to configuracion_comercio
ALTER TABLE public.configuracion_comercio 
ADD COLUMN afip_modo TEXT NOT NULL DEFAULT 'homologacion' 
CHECK (afip_modo IN ('homologacion', 'produccion'));