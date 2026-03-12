import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Cheque, ChequeEstado } from '@/hooks/useCheques';

const ESTADO_LABELS: Record<ChequeEstado, string> = {
  en_cartera: 'En Cartera',
  depositado: 'Depositado',
  cobrado: 'Cobrado',
  rechazado: 'Rechazado',
  endosado: 'Endosado',
  vencido: 'Vencido',
  anulado: 'Anulado',
};

const TRANSICIONES: Record<ChequeEstado, ChequeEstado[]> = {
  en_cartera: ['depositado', 'endosado', 'vencido', 'anulado'],
  depositado: ['cobrado', 'rechazado'],
  cobrado: [],
  rechazado: ['en_cartera'],
  endosado: [],
  vencido: ['en_cartera'],
  anulado: [],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: Cheque | null;
  onSubmit: (chequeId: string, nuevoEstado: ChequeEstado, datosExtra?: Record<string, any>, observaciones?: string) => void;
}

export function CambiarEstadoChequeDialog({ open, onOpenChange, cheque, onSubmit }: Props) {
  const [nuevoEstado, setNuevoEstado] = useState<ChequeEstado | ''>('');
  const [observaciones, setObservaciones] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [endosadoA, setEndosadoA] = useState('');
  const [bancoDeposito, setBancoDeposito] = useState('');
  const [cuentaDeposito, setCuentaDeposito] = useState('');

  if (!cheque) return null;

  const estadosPosibles = TRANSICIONES[cheque.estado] || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoEstado) return;

    const datosExtra: Record<string, any> = {};
    if (nuevoEstado === 'rechazado') {
      datosExtra.motivo_rechazo = motivoRechazo;
      datosExtra.fecha_rechazo = new Date().toISOString().split('T')[0];
    }
    if (nuevoEstado === 'endosado') {
      datosExtra.endosado_a = endosadoA;
      datosExtra.fecha_endoso = new Date().toISOString().split('T')[0];
    }
    if (nuevoEstado === 'depositado') {
      datosExtra.banco_deposito = bancoDeposito;
      datosExtra.cuenta_deposito = cuentaDeposito;
      datosExtra.fecha_deposito = new Date().toISOString().split('T')[0];
    }
    if (nuevoEstado === 'cobrado') {
      datosExtra.fecha_cobro = new Date().toISOString().split('T')[0];
    }

    onSubmit(cheque.id, nuevoEstado, datosExtra, observaciones);
    setNuevoEstado('');
    setObservaciones('');
    setMotivoRechazo('');
    setEndosadoA('');
    setBancoDeposito('');
    setCuentaDeposito('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar Estado - Cheque #{cheque.numero_cheque}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p><span className="font-medium">Estado actual:</span> {ESTADO_LABELS[cheque.estado]}</p>
            <p><span className="font-medium">Monto:</span> ${Number(cheque.monto).toLocaleString()}</p>
            <p><span className="font-medium">Banco:</span> {cheque.banco}</p>
          </div>

          {estadosPosibles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este cheque no permite cambios de estado.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Nuevo Estado</Label>
                <Select value={nuevoEstado} onValueChange={v => setNuevoEstado(v as ChequeEstado)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {estadosPosibles.map(e => (
                      <SelectItem key={e} value={e}>{ESTADO_LABELS[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {nuevoEstado === 'rechazado' && (
                <div className="space-y-2">
                  <Label>Motivo de Rechazo</Label>
                  <Input value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)} />
                </div>
              )}

              {nuevoEstado === 'endosado' && (
                <div className="space-y-2">
                  <Label>Endosado a</Label>
                  <Input value={endosadoA} onChange={e => setEndosadoA(e.target.value)} />
                </div>
              )}

              {nuevoEstado === 'depositado' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco Depósito</Label>
                    <Input value={bancoDeposito} onChange={e => setBancoDeposito(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cuenta</Label>
                    <Input value={cuentaDeposito} onChange={e => setCuentaDeposito(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={!nuevoEstado}>Confirmar</Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
