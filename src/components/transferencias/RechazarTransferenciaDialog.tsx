import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRechazarTransferencia } from '@/hooks/useTransferencias';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transferenciaId: string | null;
}

export function RechazarTransferenciaDialog({ open, onOpenChange, transferenciaId }: Props) {
  const [obs, setObs] = useState('');
  const rechazar = useRechazarTransferencia();

  useEffect(() => { if (!open) setObs(''); }, [open]);

  const submit = async () => {
    if (!transferenciaId) return;
    if (!obs.trim()) return toast.error('La observación es obligatoria');
    await rechazar.mutateAsync({ id: transferenciaId, observacion: obs.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar Transferencia</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo del rechazo *</Label>
          <Textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={4}
            placeholder="Ej.: Importe incorrecto / Comprobante inválido / Transferencia no encontrada / Datos inconsistentes"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={submit} disabled={rechazar.isPending}>Rechazar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}