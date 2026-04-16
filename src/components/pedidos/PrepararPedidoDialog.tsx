import { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, X, Check, Calculator, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePedido, type PedidoDetalle } from '@/hooks/usePedidos';
import { usePrepararPedido } from '@/hooks/usePrepararPedido';


interface PrepararPedidoDialogProps {
  pedidoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoIds?: string[];
  onNavigate?: (pedidoId: string) => void;
}

interface LineaPreparacion {
  detalleId: string;
  productoId: string | null;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidadPedida: number;
  inputValue: string;
  cantidadPreparada: number; // valor calculado
  subtotal: number; // valor calculado
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

export function PrepararPedidoDialog({ pedidoId, open, onOpenChange, pedidoIds, onNavigate }: PrepararPedidoDialogProps) {
  const [lineas, setLineas] = useState<LineaPreparacion[]>([]);
  
  const { data: pedido, isLoading } = usePedido(pedidoId || undefined);
  const prepararPedido = usePrepararPedido();

  // Navigation between pedidos
  const currentIndex = pedidoIds && pedidoId ? pedidoIds.indexOf(pedidoId) : -1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = pedidoIds ? currentIndex < pedidoIds.length - 1 : false;

  const goToPrev = useCallback(() => {
    if (canGoPrev && pedidoIds && onNavigate) {
      onNavigate(pedidoIds[currentIndex - 1]);
    }
  }, [canGoPrev, pedidoIds, currentIndex, onNavigate]);

  const goToNext = useCallback(() => {
    if (canGoNext && pedidoIds && onNavigate) {
      onNavigate(pedidoIds[currentIndex + 1]);
    }
  }, [canGoNext, pedidoIds, currentIndex, onNavigate]);

  // Keyboard navigation: PageUp / PageDown
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PageDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goToNext, goToPrev]);

  // Initialize lines when dialog opens
  useEffect(() => {
    if (open && pedido?.detalles) {
      setLineas(pedido.detalles.map((d: PedidoDetalle) => {
        const esPorPeso = isProductoPorPeso(d.producto?.unidad_medida || 'UN');
        const precioConDescuento = d.precio_unitario * (1 - (d.descuento_porcentaje || 0) / 100);
        return {
          detalleId: d.id,
          productoId: d.producto_id,
          codigo: d.producto?.codigo_articulo || '',
          descripcion: d.producto?.descripcion || '',
          unidadMedida: d.producto?.unidad_medida || 'UN',
          cantidadPedida: d.cantidad_pedida,
          inputValue: formatCantidadInicial(d.cantidad_pedida, esPorPeso),
          cantidadPreparada: d.cantidad_pedida,
          subtotal: d.cantidad_pedida * precioConDescuento,
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

  const handlePrecioChange = (detalleId: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setLineas(prev => prev.map(l => {
      if (l.detalleId !== detalleId) return l;
      const precioConDescuento = num * (1 - l.descuentoPorcentaje / 100);
      return { ...l, precioUnitario: num, subtotal: l.cantidadPreparada * precioConDescuento };
    }));
  };

  const handleDescuentoChange = (detalleId: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    const descuento = Math.min(100, num);
    setLineas(prev => prev.map(l => {
      if (l.detalleId !== detalleId) return l;
      const precioConDescuento = l.precioUnitario * (1 - descuento / 100);
      return { ...l, descuentoPorcentaje: descuento, subtotal: l.cantidadPreparada * precioConDescuento };
    }));
  };

  // Botón calcular - actualiza cantidadPreparada y subtotal
  const handleCalcular = (detalleId: string) => {
    setLineas(prev => prev.map(l => {
      if (l.detalleId !== detalleId) return l;
      
      const esPorPeso = isProductoPorPeso(l.unidadMedida);
      const cantidadParsed = parseCantidad(l.inputValue, esPorPeso);
      const precioConDescuento = l.precioUnitario * (1 - l.descuentoPorcentaje / 100);
      const subtotal = cantidadParsed * precioConDescuento;
      
      return { ...l, cantidadPreparada: cantidadParsed, subtotal };
    }));
  };

  // Valores derivados del estado
  const totalFinal = lineas.reduce((sum, l) => sum + l.subtotal, 0);
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
        subtotal: l.subtotal,
      })),
      totalFinal: totalFinal,
    });

    if (resultado) {
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
        <div className="flex items-center gap-2">
          {pedidoIds && pedidoIds.length > 1 && (
            <>
              <Button variant="outline" size="sm" onClick={goToPrev} disabled={!canGoPrev} title="Pedido anterior (Re Pág)">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {pedidoIds.length}
              </span>
              <Button variant="outline" size="sm" onClick={goToNext} disabled={!canGoNext} title="Siguiente pedido (Av Pág)">
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
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
              const esMenor = linea.cantidadPreparada < linea.cantidadPedida;
              const esMayor = linea.cantidadPreparada > linea.cantidadPedida;
              const hayDiferencia = esMenor || esMayor;
              
              return (
                <div 
                  key={linea.detalleId}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    esMayor ? 'border-blue-400 bg-blue-50' : 
                    esMenor ? 'border-amber-400 bg-amber-50' : 
                    'border-border bg-card'
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
                        {esMayor && (
                          <Badge className="text-xs bg-blue-500 text-white">+Mayor</Badge>
                        )}
                        {esMenor && (
                          <Badge className="text-xs bg-amber-500 text-white">-Menor</Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{linea.descripcion}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Precio:</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={linea.precioUnitario}
                            onChange={(e) => handlePrecioChange(linea.detalleId, e.target.value)}
                            className="w-24 h-7 text-sm text-right"
                          />
                          {esPorPeso && <span className="text-xs text-muted-foreground">/kg</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Dto:</span>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={linea.descuentoPorcentaje}
                            onChange={(e) => handleDescuentoChange(linea.detalleId, e.target.value)}
                            className="w-16 h-7 text-sm text-right"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Pedido</p>
                        <p className="font-medium text-lg">
                          {formatCantidadInicial(linea.cantidadPedida, esPorPeso)} {linea.unidadMedida}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">A Preparar</p>
                      <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={linea.inputValue}
                            onChange={(e) => handleInputChange(linea.detalleId, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCalcular(linea.detalleId);
                              }
                            }}
                            className={`w-28 text-center font-medium text-lg ${
                              esMayor ? 'border-blue-500 bg-blue-50' :
                              esMenor ? 'border-amber-500 bg-amber-50' : ''
                            }`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleCalcular(linea.detalleId)}
                            title="Calcular"
                          >
                            <Calculator className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-right min-w-[120px]">
                        <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                        <p className={`font-bold text-lg ${
                          esMayor ? 'text-blue-700' : esMenor ? 'text-amber-700' : ''
                        }`}>
                          {formatCurrency(linea.subtotal)}
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
                    Confirmar
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
