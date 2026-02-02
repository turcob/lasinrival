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
import { useCambiarEstadoPedido, useAnularPedido, type PedidoEstado } from '@/hooks/usePedidos';

interface CambiarEstadoDialogProps {
  pedidoId: string;
  estadoActual: PedidoEstado;
  nuevoEstado: PedidoEstado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const estadoLabels: Record<PedidoEstado, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  preparado: 'Preparado',
  despachado: 'Despachado',
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
  const anularPedido = useAnularPedido();

  if (!nuevoEstado) return null;

  const esAnulacion = nuevoEstado === 'anulado';

  const handleConfirmar = async () => {
    if (esAnulacion) {
      await anularPedido.mutateAsync({
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

  const isPending = cambiarEstado.isPending || anularPedido.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esAnulacion ? 'Anular Pedido' : `Cambiar a ${estadoLabels[nuevoEstado]}`}
          </DialogTitle>
          <DialogDescription>
            {esAnulacion 
              ? 'Esta acción no se puede deshacer. El pedido quedará marcado como anulado.'
              : `El pedido pasará de "${estadoLabels[estadoActual]}" a "${estadoLabels[nuevoEstado]}".`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{esAnulacion ? 'Motivo de anulación *' : 'Observaciones (opcional)'}</Label>
            <Textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder={esAnulacion ? 'Ingrese el motivo de la anulación...' : 'Agregar comentarios...'}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            variant={esAnulacion ? 'destructive' : 'default'}
            onClick={handleConfirmar}
            disabled={isPending || (esAnulacion && !observaciones.trim())}
          >
            {isPending ? 'Procesando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
