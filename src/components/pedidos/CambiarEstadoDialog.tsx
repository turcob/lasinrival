import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCambiarEstadoPedido, useRechazarPedido, type PedidoEstado } from '@/hooks/usePedidos';

interface CambiarEstadoDialogProps {
  pedidoId: string;
  estadoActual: PedidoEstado;
  nuevoEstado: PedidoEstado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const estadoLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  preparado: 'Preparado',
  despachado: 'Despachado',
  rechazado: 'Rechazado',
  // Legacy labels para historial
  confirmado: 'Confirmado',
  entregado: 'Entregado',
  parcial: 'Entrega Parcial',
  devuelto: 'Devuelto',
  anulado: 'Anulado',
};

export function CambiarEstadoDialog({ 
  pedidoId, 
  estadoActual, 
  nuevoEstado, 
  open, 
  onOpenChange 
}: CambiarEstadoDialogProps) {
  const [observaciones, setObservaciones] = useState('');
  
  const cambiarEstado = useCambiarEstadoPedido();
  const rechazarPedido = useRechazarPedido();

  if (!nuevoEstado) return null;

  const esRechazo = nuevoEstado === 'rechazado';

  const handleConfirmar = async () => {
    if (esRechazo) {
      await rechazarPedido.mutateAsync({
        pedidoId,
        motivo: observaciones || 'Sin motivo especificado'
      });
    } else {
      await cambiarEstado.mutateAsync({
        pedidoId,
        nuevoEstado,
        observaciones: observaciones || undefined
      });
    }
    setObservaciones('');
    onOpenChange(false);
  };

  const isPending = cambiarEstado.isPending || rechazarPedido.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esRechazo ? 'Rechazar Pedido' : `Cambiar a ${estadoLabels[nuevoEstado] || nuevoEstado}`}
          </DialogTitle>
          <DialogDescription>
            {esRechazo 
              ? 'Esta acción no se puede deshacer. El pedido quedará marcado como rechazado.'
              : `El pedido pasará de "${estadoLabels[estadoActual] || estadoActual}" a "${estadoLabels[nuevoEstado] || nuevoEstado}".`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{esRechazo ? 'Motivo de rechazo *' : 'Observaciones (opcional)'}</Label>
            <Textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder={esRechazo ? 'Ingrese el motivo del rechazo...' : 'Agregar comentarios...'}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant={esRechazo ? 'destructive' : 'default'}
            onClick={handleConfirmar}
            disabled={isPending || (esRechazo && !observaciones.trim())}
          >
            {isPending ? 'Procesando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
