import { useState, useEffect, useMemo } from 'react';
import { Printer, Package, AlertTriangle } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { usePedido, type PedidoDetalle } from '@/hooks/usePedidos';
import { usePrepararPedido } from '@/hooks/usePrepararPedido';
import { imprimirRemito } from '@/lib/imprimirRemito';

interface PrepararPedidoDialogProps {
  pedidoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LineaPreparacion {
  detalleId: string;
  productoId: string | null;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidadPedida: number;
  cantidadPreparada: number;
  cantidadTexto: string; // String para el input controlado
  precioUnitario: number;
  descuentoPorcentaje: number;
}

const isProductoPorPeso = (unidadMedida: string) => {
  const unidad = (unidadMedida || '').toUpperCase().replace('.', '').trim();
  return unidad === 'KG' || unidad === 'KILO' || unidad === 'KILOS';
};

const formatCantidadInicial = (cantidad: number, esPorPeso: boolean) => {
  return esPorPeso ? cantidad.toFixed(3).replace('.', ',') : cantidad.toString();
};

export function PrepararPedidoDialog({ pedidoId, open, onOpenChange }: PrepararPedidoDialogProps) {
  const [lineas, setLineas] = useState<LineaPreparacion[]>([]);
  
  const { data: pedido, isLoading } = usePedido(pedidoId || undefined);
  const prepararPedido = usePrepararPedido();

  // Initialize lines from pedido - only when dialog opens or pedido loads
  useEffect(() => {
    if (open && pedido?.detalles) {
      setLineas(pedido.detalles.map((d: PedidoDetalle) => {
        const esPorPeso = isProductoPorPeso(d.producto?.unidad_medida || 'UN');
        return {
          detalleId: d.id,
          productoId: d.producto_id,
          codigo: d.producto?.codigo_articulo || '',
          descripcion: d.producto?.descripcion || '',
          unidadMedida: d.producto?.unidad_medida || 'UN',
          cantidadPedida: d.cantidad_pedida,
          cantidadPreparada: d.cantidad_pedida,
          cantidadTexto: formatCantidadInicial(d.cantidad_pedida, esPorPeso),
          precioUnitario: d.precio_unitario,
          descuentoPorcentaje: d.descuento_porcentaje || 0,
        };
      }));
    }
  }, [open, pedido?.id]); // Solo reinicializar cuando cambia el pedido o se abre el diálogo

  const handleCantidadChange = (detalleId: string, value: string, esPorPeso: boolean) => {
    setLineas(prev => prev.map(l => {
      if (l.detalleId !== detalleId) return l;
      
      // Actualizar el texto del input directamente
      const normalizedValue = value.replace(',', '.');
      const cantidad = esPorPeso ? (parseFloat(normalizedValue) || 0) : (parseInt(value) || 0);
      const cantidadFinal = Math.min(Math.max(0, cantidad), l.cantidadPedida);
      
      return { 
        ...l, 
        cantidadTexto: value,
        cantidadPreparada: cantidadFinal 
      };
    }));
  };


  const calcularSubtotalLinea = (linea: LineaPreparacion) => {
    const precioConDescuento = linea.precioUnitario * (1 - linea.descuentoPorcentaje / 100);
    return linea.cantidadPreparada * precioConDescuento;
  };

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((sum, l) => sum + calcularSubtotalLinea(l), 0);
    return { subtotal, total: subtotal };
  }, [lineas]);

  const hayDiferencias = lineas.some(l => l.cantidadPreparada !== l.cantidadPedida);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const handleConfirmar = async () => {
    if (!pedido) return;

    const resultado = await prepararPedido.mutateAsync({
      pedidoId: pedido.id,
      clienteId: pedido.cliente_id,
      numeroPedido: pedido.numero_pedido,
      clienteNombre: pedido.cliente?.nombre || 'Cliente',
      clienteDireccion: pedido.cliente?.direccion || '',
      lineas: lineas.map(l => ({
        detalleId: l.detalleId,
        productoId: l.productoId,
        codigo: l.codigo,
        descripcion: l.descripcion,
        cantidadPedida: l.cantidadPedida,
        cantidadPreparada: l.cantidadPreparada,
        precioUnitario: l.precioUnitario,
        descuentoPorcentaje: l.descuentoPorcentaje,
        subtotal: calcularSubtotalLinea(l),
      })),
      totalFinal: totales.total,
    });

    if (resultado) {
      // Print remito
      imprimirRemito({
        numeroPedido: pedido.numero_pedido,
        fecha: new Date(),
        cliente: {
          nombre: pedido.cliente?.nombre || '',
          direccion: pedido.cliente?.direccion || '',
          cuit: pedido.cliente?.dni_cuit || '',
        },
        lineas: lineas.filter(l => l.cantidadPreparada > 0).map(l => ({
          codigo: l.codigo,
          descripcion: l.descripcion,
          cantidad: l.cantidadPreparada,
          precioUnitario: l.precioUnitario,
          descuento: l.descuentoPorcentaje,
          subtotal: calcularSubtotalLinea(l),
        })),
        total: totales.total,
      });
      onOpenChange(false);
    }
  };

  if (!pedidoId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Preparar Pedido #{pedido?.numero_pedido?.toString().padStart(6, '0')}
          </DialogTitle>
          <DialogDescription>
            Ajuste las cantidades a preparar. El nuevo total se registrará en la cuenta corriente del cliente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-center w-[80px]">Pedido</TableHead>
                    <TableHead className="text-center w-[120px]">A Preparar</TableHead>
                    <TableHead className="text-right w-[100px]">Precio</TableHead>
                    <TableHead className="text-right w-[100px]">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((linea) => {
                    const diferencia = linea.cantidadPreparada !== linea.cantidadPedida;
                    const esPorPeso = isProductoPorPeso(linea.unidadMedida);
                    return (
                      <TableRow key={linea.detalleId} className={diferencia ? 'bg-yellow-50' : ''}>
                        <TableCell className="font-mono text-sm">{linea.codigo}</TableCell>
                        <TableCell>
                          <div>{linea.descripcion}</div>
                          {esPorPeso && (
                            <span className="text-xs text-muted-foreground">Por peso (kg)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {esPorPeso 
                            ? linea.cantidadPedida.toFixed(3).replace('.', ',')
                            : linea.cantidadPedida
                          } {linea.unidadMedida}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={linea.cantidadTexto}
                            onChange={(e) => handleCantidadChange(linea.detalleId, e.target.value, esPorPeso)}
                            className={`w-24 text-center mx-auto ${diferencia ? 'border-yellow-500' : ''}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(linea.precioUnitario)}
                          {esPorPeso && <span className="text-xs text-muted-foreground">/kg</span>}
                          {linea.descuentoPorcentaje > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (-{linea.descuentoPorcentaje}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(calcularSubtotalLinea(linea))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <Separator />

            {/* Warnings if quantities differ */}
            {hayDiferencias && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Preparación parcial</p>
                  <p className="text-yellow-700">
                    Algunos productos tienen cantidades menores a las pedidas. El total se ajustará automáticamente.
                  </p>
                </div>
              </div>
            )}

            {/* Totals summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Original</p>
                  <p className="text-lg">{formatCurrency(pedido?.total || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Nuevo Total</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totales.total)}</p>
                </div>
              </div>
              {hayDiferencias && (
                <p className="text-sm text-muted-foreground mt-2">
                  Diferencia: {formatCurrency(totales.total - (pedido?.total || 0))}
                </p>
              )}
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmar}
            disabled={prepararPedido.isPending || totales.total === 0}
          >
            <Printer className="h-4 w-4 mr-2" />
            {prepararPedido.isPending ? 'Procesando...' : 'Confirmar y Imprimir Remito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
