ALTER TABLE public.configuracion_comercio ADD COLUMN monto_adeudado_bloqueo numeric NOT NULL DEFAULT 0;
ALTER TABLE public.clientes ADD COLUMN monto_adeudado_bloqueo_override numeric NULL;