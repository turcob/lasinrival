import { useState, useEffect } from 'react';
import { Package, AlertTriangle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  inputValue: string;
  precioUnitario: number;
  descuentoPorcentaje: number;
}

const isProductoPorPeso = (unidadMedida: string) => {
  const unidad = (unidadMedida || '').toUpperCase().replace('.', '').trim();
  return unidad === 'KG' || unidad === 'KILO' || unidad === 'KILOS';
};

const parseCantidad = (value: string, esPorPeso: boolean): number => {
  const normalized = value.replace(',', '.');
  const parsed = esPorPeso ? parseFloat(normalized) : parseInt(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

const formatCantidadInicial = (cantidad: number, esPorPeso: boolean): string => {
  return esPorPeso ? cantidad.toFixed(3).replace('.', ',') : cantidad.toString();
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

export function PrepararPedidoDialog({ pedidoId, open, onOpenChange }: PrepararPedidoDialogProps) {
  const [lineas, setLineas] = useState<LineaPreparacion[]>([]);
  
  const { data: pedido, isLoading } = usePedido(pedidoId || undefined);
  const prepararPedido = usePrepararPedido();

  // Initialize lines when dialog opens
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
          inputValue: formatCantidadInicial(d.cantidad_pedida, esPorPeso),
          precioUnitario: d.precio_unitario,
          descuentoPorcentaje: d.descuento_porcentaje || 0,
        };
      }));
    }
  }, [open, pedido?.id]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setLineas([]);
    }
  }, [open]);

  const handleInputChange = (detalleId: string, value: string) => {
    setLineas(prev => prev.map(l => 
      l.detalleId === detalleId ? { ...l, inputValue: value } : l
    ));
  };

  // Cálculos derivados - se recalculan en cada render cuando cambia lineas
  const lineasCalculadas = lineas.map(linea => {
    const esPorPeso = isProductoPorPeso(linea.unidadMedida);
    const cantidadParsed = parseCantidad(linea.inputValue, esPorPeso);
    const cantidadPreparada = Math.min(Math.max(0, cantidadParsed), linea.cantidadPedida);
    const precioConDescuento = linea.precioUnitario * (1 - linea.descuentoPorcentaje / 100);
    const subtotal = cantidadPreparada * precioConDescuento;
    const diferencia = cantidadPreparada !== linea.cantidadPedida;
    return { ...linea, esPorPeso, cantidadPreparada, subtotal, diferencia };
  });

  const totalFinal = lineasCalculadas.reduce((sum, l) => sum + l.subtotal, 0);
  const hayDiferencias = lineasCalculadas.some(l => l.diferencia);

  const handleConfirmar = async () => {
    if (!pedido) return;

    const resultado = await prepararPedido.mutateAsync({
      pedidoId: pedido.id,
      clienteId: pedido.cliente_id,
      numeroPedido: pedido.numero_pedido,
      clienteNombre: pedido.cliente?.nombre || 'Cliente',
      clienteDireccion: pedido.cliente?.direccion || '',
      lineas: lineasCalculadas.map(l => ({
        detalleId: l.detalleId,
        productoId: l.productoId,
        codigo: l.codigo,
        descripcion: l.descripcion,
        cantidadPedida: l.cantidadPedida,
        cantidadPreparada: l.cantidadPreparada,
        precioUnitario: l.precioUnitario,
        descuentoPorcentaje: l.descuentoPorcentaje,
        subtotal: l.subtotal,
      })),
      totalFinal: totalFinal,
    });

    if (resultado) {
      imprimirRemito({
        numeroPedido: pedido.numero_pedido,
        fecha: new Date(),
        cliente: {
          nombre: pedido.cliente?.nombre || '',
          direccion: pedido.cliente?.direccion || '',
          cuit: pedido.cliente?.dni_cuit || '',
        },
        lineas: lineasCalculadas.filter(l => l.cantidadPreparada > 0).map(l => ({
          codigo: l.codigo,
          descripcion: l.descripcion,
          cantidad: l.cantidadPreparada,
          precioUnitario: l.precioUnitario,
          descuento: l.descuentoPorcentaje,
          subtotal: l.subtotal,
        })),
        total: totalFinal,
      });
      onOpenChange(false);
    }
  };

  if (!open || !pedidoId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">
              Preparar Pedido #{pedido?.numero_pedido?.toString().padStart(6, '0')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {pedido?.cliente?.nombre} • {pedido?.cliente?.direccion}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {lineasCalculadas.map((linea) => (
              <div 
                key={linea.detalleId}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  linea.diferencia ? 'border-amber-400 bg-amber-50' : 'border-border bg-card'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-muted-foreground">{linea.codigo}</span>
                      {linea.esPorPeso && (
                        <Badge variant="outline" className="text-xs">Por Peso</Badge>
                      )}
                      {linea.diferencia && (
                        <Badge variant="secondary" className="text-xs bg-amber-200 text-amber-800">Modificado</Badge>
                      )}
                    </div>
                    <p className="font-medium truncate">{linea.descripcion}</p>
                    <p className="text-sm text-muted-foreground">
                      Precio: {formatCurrency(linea.precioUnitario)}
                      {linea.esPorPeso && '/kg'}
                      {linea.descuentoPorcentaje > 0 && ` (-${linea.descuentoPorcentaje}%)`}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Pedido</p>
                      <p className="font-medium text-lg">
                        {formatCantidadInicial(linea.cantidadPedida, linea.esPorPeso)} {linea.unidadMedida}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">A Preparar</p>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={linea.inputValue}
                        onChange={(e) => handleInputChange(linea.detalleId, e.target.value)}
                        className={`w-32 text-center font-medium text-lg ${
                          linea.diferencia ? 'border-amber-500 bg-amber-50' : ''
                        }`}
                      />
                    </div>

                    <div className="text-right min-w-[120px]">
                      <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                      <p className={`font-bold text-lg ${linea.diferencia ? 'text-amber-700' : ''}`}>
                        {formatCurrency(linea.subtotal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto">
          {hayDiferencias && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Preparación parcial</p>
                <p className="text-amber-700">
                  Algunos productos tienen cantidades menores a las pedidas. El total se ajustará automáticamente.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex gap-8">
              <div>
                <p className="text-sm text-muted-foreground">Total Original</p>
                <p className="text-xl font-medium">{formatCurrency(pedido?.total || 0)}</p>
              </div>
              <Separator orientation="vertical" className="h-12 hidden md:block" />
              <div>
                <p className="text-sm text-muted-foreground">Nuevo Total</p>
                <p className={`text-2xl font-bold ${hayDiferencias ? 'text-amber-700' : 'text-primary'}`}>
                  {formatCurrency(totalFinal)}
                </p>
                {hayDiferencias && (
                  <p className="text-xs text-muted-foreground">
                    Diferencia: {formatCurrency(totalFinal - (pedido?.total || 0))}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} size="lg">
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmar}
                disabled={prepararPedido.isPending || totalFinal === 0}
                size="lg"
                className="min-w-[200px]"
              >
                {prepararPedido.isPending ? (
                  <>Procesando...</>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Confirmar e Imprimir
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
