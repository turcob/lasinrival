-- Agregar campos para personalización del sistema
ALTER TABLE public.configuracion_comercio 
ADD COLUMN IF NOT EXISTS nombre_sistema TEXT DEFAULT 'GestiónPro',
ADD COLUMN IF NOT EXISTS texto_login_footer TEXT DEFAULT 'Sistema de Gestión Comercial © 2024';