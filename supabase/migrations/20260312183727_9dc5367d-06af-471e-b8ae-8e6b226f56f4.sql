
ALTER TABLE public.proveedor_movimientos 
  ADD COLUMN medio_pago text,
  ADD COLUMN caja_id uuid REFERENCES public.cajas(id),
  ADD COLUMN banco_transferencia text,
  ADD COLUMN referencia_transferencia text,
  ADD COLUMN cheque_id uuid REFERENCES public.cheques(id),
  ADD COLUMN cheque_propio_banco text,
  ADD COLUMN cheque_propio_numero text,
  ADD COLUMN cheque_propio_fecha_emision date,
  ADD COLUMN cheque_propio_fecha_vencimiento date,
  ADD COLUMN cheque_propio_monto numeric;
