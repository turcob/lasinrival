-- Add condicion_iva field to clientes table for AFIP invoicing
ALTER TABLE public.clientes 
ADD COLUMN condicion_iva integer DEFAULT 5; -- 5 = Consumidor Final by default

COMMENT ON COLUMN public.clientes.condicion_iva IS '1=Resp.Inscripto, 4=Exento, 5=Cons.Final, 6=Monotributo';