import { useState } from 'react';
import { AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRendirPedido, type Pedido } from '@/hooks/usePedidos';

interface RendirPedidoDialogProps {
  pedido: Pedido;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface DevolucionItem {
  detalleId: string;
  cantidadPedida: number;
  cantidadDevuelta: number;
  motivo: string;
}

export function RendirPedidoDialog({ pedido, open, onOpenChange, onSuccess }: RendirPedidoDialogProps) {
  const [devoluciones, setDevoluciones] = useState<DevolucionItem[]>(() =>
    pedido.detalles?.map(d => ({
      detalleId: d.id,
      cantidadPedida: d.cantidad_pedida,
      cantidadDevuelta: 0,
      motivo: ''
    })) || []
  );

  const rendirPedido = useRendirPedido();

  const actualizarDevolucion = (detalleId: string, campo: 'cantidadDevuelta' | 'motivo', valor: number | string) => {
    setDevoluciones(devs => devs.map(d => {
      if (d.detalleId === detalleId) {
        if (campo === 'cantidadDevuelta') {
          const cantidad = Math.min(Math.max(0, Number(valor)), d.cantidadPedida);
          return { ...d, cantidadDevuelta: cantidad };
        }
        return { ...d, motivo: valor as string };
      }
      return d;
    }));
  };

  const hayDevoluciones = devoluciones.some(d => d.cantidadDevuelta > 0);

  const calcularTotalFinal = () => {
    return pedido.detalles?.reduce((sum, det) => {
      const dev = devoluciones.find(d => d.detalleId === det.id);
      const cantidadEntregada = det.cantidad_pedida - (dev?.cantidadDevuelta || 0);
      const precio = det.precio_unitario * (1 - (det.descuento_porcentaje || 0) / 100);
      return sum + (cantidadEntregada * precio);
    }, 0) || 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const handleRendir = async () => {
    await rendirPedido.mutateAsync({
      pedidoId: pedido.id,
      devoluciones: devoluciones.map(d => ({
        detalleId: d.detalleId,
        cantidad: d.cantidadDevuelta,
        motivo: d.motivo || undefined
      }))
    });
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Rendir Pedido #{pedido.numero_pedido?.toString().padStart(6, '0')}
          </DialogTitle>
          <DialogDescription>
            Registra las cantidades entregadas y devoluciones. Al confirmar se generará la venta correspondiente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hayDevoluciones && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Hay productos con devolución. El stock se reingresará automáticamente.
              </AlertDescription>
            </Alert>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center w-24">Pedido</TableHead>
                  <TableHead className="text-center w-32">Devuelto</TableHead>
                  <TableHead className="text-center w-24">Entregado</TableHead>
                  <TableHead className="w-48">Motivo devolución</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedido.detalles?.map(det => {
                  const dev = devoluciones.find(d => d.detalleId === det.id);
                  const cantidadEntregada = det.cantidad_pedida - (dev?.cantidadDevuelta || 0);
                  
                  return (
                    <TableRow key={det.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{det.producto?.descripcion}</p>
                          <p className="text-xs text-muted-foreground">{det.producto?.codigo_articulo}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {det.cantidad_pedida}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={det.cantidad_pedida}
                          value={dev?.cantidadDevuelta || 0}
                          onChange={e => actualizarDevolucion(det.id, 'cantidadDevuelta', e.target.value)}
                          className="w-20 mx-auto text-center"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cantidadEntregada < det.cantidad_pedida ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                          {cantidadEntregada}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(dev?.cantidadDevuelta || 0) > 0 && (
                          <Input
                            placeholder="Motivo..."
                            value={dev?.motivo || ''}
                            onChange={e => actualizarDevolucion(det.id, 'motivo', e.target.value)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total original</p>
                <p className="text-lg line-through text-muted-foreground">{formatCurrency(pedido.total)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total final</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(calcularTotalFinal())}</p>
              </div>
            </div>
            {hayDevoluciones && (
              <p className="text-sm text-orange-600 mt-2 flex items-center gap-1">
                <RotateCcw className="h-4 w-4" />
                Diferencia por devoluciones: {formatCurrency(pedido.total - calcularTotalFinal())}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleRendir} disabled={rendirPedido.isPending}>
            {rendirPedido.isPending ? 'Procesando...' : 'Confirmar Rendición'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
