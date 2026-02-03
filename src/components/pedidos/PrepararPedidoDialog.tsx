import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Printer, Package, AlertTriangle, X, Check } from 'lucide-react';
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
  cantidadPreparada: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
}

const isProductoPorPeso = (unidadMedida: string) => {
  const unidad = (unidadMedida || '').toUpperCase().replace('.', '').trim();
  return unidad === 'KG' || unidad === 'KILO' || unidad === 'KILOS';
};

const parseCantidad = (value: string, esPorPeso: boolean): number => {
  const normalized = value.replace(',', '.');
  return esPorPeso ? (parseFloat(normalized) || 0) : (parseInt(value) || 0);
};

const formatCantidad = (cantidad: number, esPorPeso: boolean): string => {
  return esPorPeso ? cantidad.toFixed(3).replace('.', ',') : cantidad.toString();
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
};

export function PrepararPedidoDialog({ pedidoId, open, onOpenChange }: PrepararPedidoDialogProps) {
  const [lineas, setLineas] = useState<LineaPreparacion[]>([]);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  
  const { data: pedido, isLoading } = usePedido(pedidoId || undefined);
  const prepararPedido = usePrepararPedido();

  // Initialize lines when dialog opens
  useEffect(() => {
    if (open && pedido?.detalles) {
      setLineas(pedido.detalles.map((d: PedidoDetalle) => ({
        detalleId: d.id,
        productoId: d.producto_id,
        codigo: d.producto?.codigo_articulo || '',
        descripcion: d.producto?.descripcion || '',
        unidadMedida: d.producto?.unidad_medida || 'UN',
        cantidadPedida: d.cantidad_pedida,
        cantidadPreparada: d.cantidad_pedida,
        precioUnitario: d.precio_unitario,
        descuentoPorcentaje: d.descuento_porcentaje || 0,
      })));
    }
  }, [open, pedido?.id]);

  // Clear refs when dialog closes
  useEffect(() => {
    if (!open) {
      inputRefs.current.clear();
    }
  }, [open]);

  const handleInputChange = useCallback((detalleId: string, esPorPeso: boolean, maxCantidad: number) => {
    const input = inputRefs.current.get(detalleId);
    if (!input) return;
    
    const cantidad = parseCantidad(input.value, esPorPeso);
    const cantidadFinal = Math.min(Math.max(0, cantidad), maxCantidad);
    
    setLineas(prev => prev.map(l => 
      l.detalleId === detalleId ? { ...l, cantidadPreparada: cantidadFinal } : l
    ));
  }, []);

  const calcularSubtotalLinea = (linea: LineaPreparacion) => {
    const precioConDescuento = linea.precioUnitario * (1 - linea.descuentoPorcentaje / 100);
    return linea.cantidadPreparada * precioConDescuento;
  };

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((sum, l) => sum + calcularSubtotalLinea(l), 0);
    return { subtotal, total: subtotal };
  }, [lineas]);

  const hayDiferencias = lineas.some(l => l.cantidadPreparada !== l.cantidadPedida);

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
            {lineas.map((linea) => {
              const esPorPeso = isProductoPorPeso(linea.unidadMedida);
              const diferencia = linea.cantidadPreparada !== linea.cantidadPedida;
              const subtotal = calcularSubtotalLinea(linea);
              
              return (
                <div 
                  key={linea.detalleId}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    diferencia ? 'border-amber-400 bg-amber-50' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-muted-foreground">{linea.codigo}</span>
                        {esPorPeso && (
                          <Badge variant="outline" className="text-xs">Por Peso</Badge>
                        )}
                        {diferencia && (
                          <Badge variant="secondary" className="text-xs bg-amber-200 text-amber-800">Modificado</Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{linea.descripcion}</p>
                      <p className="text-sm text-muted-foreground">
                        Precio: {formatCurrency(linea.precioUnitario)}
                        {esPorPeso && '/kg'}
                        {linea.descuentoPorcentaje > 0 && ` (-${linea.descuentoPorcentaje}%)`}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Pedido</p>
                        <p className="font-medium">
                          {formatCantidad(linea.cantidadPedida, esPorPeso)} {linea.unidadMedida}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">A Preparar</p>
                        <Input
                          ref={(el) => {
                            if (el) inputRefs.current.set(linea.detalleId, el);
                          }}
                          type="text"
                          inputMode="decimal"
                          defaultValue={formatCantidad(linea.cantidadPedida, esPorPeso)}
                          onChange={() => handleInputChange(linea.detalleId, esPorPeso, linea.cantidadPedida)}
                          className={`w-28 text-center font-medium ${
                            diferencia ? 'border-amber-500 bg-white' : ''
                          }`}
                        />
                      </div>

                      <div className="text-right min-w-[100px]">
                        <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                        <p className={`font-bold ${diferencia ? 'text-amber-700' : ''}`}>
                          {formatCurrency(subtotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
                  {formatCurrency(totales.total)}
                </p>
                {hayDiferencias && (
                  <p className="text-xs text-muted-foreground">
                    Diferencia: {formatCurrency(totales.total - (pedido?.total || 0))}
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
                disabled={prepararPedido.isPending || totales.total === 0}
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
