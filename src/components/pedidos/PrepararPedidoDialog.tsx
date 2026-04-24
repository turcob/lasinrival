import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, AlertTriangle, X, Calculator, ChevronLeft, ChevronRight, Plus, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePedido, type PedidoDetalle } from '@/hooks/usePedidos';
import { usePrepararPedido } from '@/hooks/usePrepararPedido';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { obtenerPrecioVentaProducto } from '@/lib/precioUtils';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';
import { imprimirRemito } from '@/lib/imprimirRemito';


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
  descuentoInput?: string;
  esNuevo?: boolean;
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
  const [busquedaProducto, setBusquedaProducto] = useState('');
  
  const { data: pedido, isLoading } = usePedido(pedidoId || undefined);
  const prepararPedido = usePrepararPedido();
  const { config } = useConfiguracionComercio();

  const { data: productos } = useQuery({
    queryKey: ['productos-activos-preparacion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('id, codigo_articulo, descripcion, precio_costo, stock_actual, marca_id, tipo_producto_id, unidad_medida')
        .eq('activo', true)
        .order('descripcion');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: listasPrecios } = useQuery({
    queryKey: ['listas-precios-preparacion'],
    queryFn: async () => {
      const { data: listas, error: listasError } = await supabase
        .from('listas_precios')
        .select('id, nombre, codigo')
        .eq('activo', true)
        .neq('destino', 'paladini');
      if (listasError) throw listasError;

      const { data: porcentajes, error: porcError } = await supabase.from('lista_precio_porcentajes').select('*');
      if (porcError) throw porcError;

      const { data: excepciones, error: excError } = await supabase.from('lista_precio_excepciones').select('*');
      if (excError) throw excError;

      return { listas, porcentajes, excepciones };
    },
    enabled: open,
  });

  // Navigation between pedidos
  const currentIndex = pedidoIds && pedidoId ? pedidoIds.indexOf(pedidoId) : -1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = pedidoIds ? currentIndex < pedidoIds.length - 1 : false;

  // Initialize lines when dialog opens
  useEffect(() => {
    if (open && pedido?.detalles) {
      // Detect implicit header-level discount (e.g. Paladini quantity discounts)
      // that wasn't propagated to per-line descuento_porcentaje.
      const sinDescuentoPorLinea = pedido.detalles.every(
        (d: PedidoDetalle) => !d.descuento_porcentaje || d.descuento_porcentaje === 0
      );
      const brutoLineas = pedido.detalles.reduce(
        (sum: number, d: PedidoDetalle) => sum + d.cantidad_pedida * d.precio_unitario,
        0
      );
      const totalPedido = pedido.total || 0;
      let descuentoImplicitoPct = 0;
      if (
        sinDescuentoPorLinea &&
        brutoLineas > 0 &&
        totalPedido > 0 &&
        totalPedido < brutoLineas - 0.01
      ) {
        descuentoImplicitoPct = Math.round(((1 - totalPedido / brutoLineas) * 100) * 100) / 100;
      }

      setLineas(pedido.detalles.map((d: PedidoDetalle) => {
        const esPorPeso = isProductoPorPeso(d.producto?.unidad_medida || 'UN');
        const descuentoLinea = (d.descuento_porcentaje || 0) || descuentoImplicitoPct;
        const precioConDescuento = d.precio_unitario * (1 - descuentoLinea / 100);
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
          descuentoPorcentaje: descuentoLinea,
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

  const recalcularLinea = useCallback((linea: LineaPreparacion) => {
    const esPorPeso = isProductoPorPeso(linea.unidadMedida);
    const cantidadParsed = parseCantidad(linea.inputValue, esPorPeso);
    const precioConDescuento = linea.precioUnitario * (1 - linea.descuentoPorcentaje / 100);
    return {
      ...linea,
      cantidadPreparada: cantidadParsed,
      subtotal: cantidadParsed * precioConDescuento,
    };
  }, []);

  const calcularPrecioProducto = useCallback((producto: any) => {
    const listaId = pedido?.lista_precio_id || listasPrecios?.listas?.[0]?.id;
    if (!listaId || !listasPrecios) return producto.precio_costo;
    return obtenerPrecioVentaProducto(
      {
        id: producto.id,
        precio_costo: producto.precio_costo,
        marca_id: producto.marca_id,
        tipo_producto_id: producto.tipo_producto_id,
      },
      listaId,
      listasPrecios.porcentajes || [],
      listasPrecios.excepciones || []
    ).precioVenta;
  }, [listasPrecios, pedido?.lista_precio_id]);

  const productosFiltrados = useMemo(() => {
    if (!busquedaProducto || !productos) return [];
    const term = busquedaProducto.toLowerCase();
    return productos
      .filter((p) =>
        p.codigo_articulo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
      )
      .filter((p) => !lineas.some((l) => l.productoId === p.id))
      .slice(0, 10);
  }, [busquedaProducto, productos, lineas]);

  const agregarProducto = (producto: any) => {
    const esPorPeso = isProductoPorPeso(producto.unidad_medida || 'UN');
    const precio = calcularPrecioProducto(producto);
    const nuevaLinea = recalcularLinea({
      detalleId: `nuevo-${producto.id}`,
      productoId: producto.id,
      codigo: producto.codigo_articulo,
      descripcion: producto.descripcion,
      unidadMedida: producto.unidad_medida || 'UN',
      cantidadPedida: 1,
      inputValue: formatCantidadInicial(1, esPorPeso),
      cantidadPreparada: 1,
      subtotal: precio,
      precioUnitario: precio,
      descuentoPorcentaje: 0,
      esNuevo: true,
    });
    setLineas((prev) => [...prev, nuevaLinea]);
    setBusquedaProducto('');
  };

  const eliminarLinea = (detalleId: string) => {
    setLineas((prev) => prev.filter((l) => l.detalleId !== detalleId));
  };

  const handleDescuentoChange = (detalleId: string, value: string) => {
    // Aceptar "." y "," como separador decimal y permitir estados intermedios ("5.", "", ".")
    const normalized = value.replace(',', '.');
    // Solo permitir dígitos y un punto decimal
    if (normalized !== '' && !/^\d*\.?\d*$/.test(normalized)) return;

    // Calcular el descuento numérico para el subtotal (vacío o "." se tratan como 0)
    const num = normalized === '' || normalized === '.' ? 0 : parseFloat(normalized);
    if (isNaN(num) || num < 0 || num > 100) return;

    setLineas(prev => prev.map(l => {
      if (l.detalleId !== detalleId) return l;
      const precioConDescuento = l.precioUnitario * (1 - num / 100);
      return {
        ...l,
        descuentoPorcentaje: num,
        descuentoInput: normalized,
        subtotal: l.cantidadPreparada * precioConDescuento,
      };
    }));
  };

  // Botón calcular - actualiza cantidadPreparada y subtotal
  const handleCalcular = (detalleId: string) => {
    setLineas(prev => prev.map(l => (l.detalleId !== detalleId ? l : recalcularLinea(l))));
  };

  // Valores derivados del estado
  const totalFinal = lineas.reduce((sum, l) => sum + l.subtotal, 0);
  const hayDiferencias = lineas.some(l => l.cantidadPreparada !== l.cantidadPedida);

  const buildLineasPayload = useCallback(() => (
    lineas.filter(l => l.productoId).map(l => ({
      detalleId: l.detalleId,
      productoId: l.productoId,
      codigo: l.codigo,
      descripcion: l.descripcion,
      cantidadPedida: l.cantidadPedida,
      cantidadPreparada: l.cantidadPreparada,
      precioUnitario: l.precioUnitario,
      descuentoPorcentaje: l.descuentoPorcentaje,
      subtotal: l.subtotal,
    }))
  ), [lineas]);

  const guardarPedido = useCallback(async () => {
    if (!pedido) return false;

    const resultado = await prepararPedido.mutateAsync({
      pedidoId: pedido.id,
      clienteId: pedido.cliente_id,
      numeroPedido: pedido.numero_pedido,
      clienteNombre: pedido.cliente?.nombre || 'Cliente',
      clienteDireccion: pedido.cliente?.direccion || '',
      lineas: buildLineasPayload(),
      totalFinal,
      estadoDestino: 'pendiente',
      registrarDeuda: false,
      observacionesHistorial: `Pedido guardado en pendiente. Total: $${totalFinal.toFixed(2)}`,
    });

    return !!resultado;
  }, [pedido, prepararPedido, buildLineasPayload, totalFinal]);

  const goToPrev = useCallback(async () => {
    if (!canGoPrev || !pedidoIds || !onNavigate || prepararPedido.isPending || totalFinal === 0) return;
    const ok = await guardarPedido();
    if (ok) onNavigate(pedidoIds[currentIndex - 1]);
  }, [canGoPrev, pedidoIds, onNavigate, prepararPedido.isPending, totalFinal, guardarPedido, currentIndex]);

  const goToNext = useCallback(async () => {
    if (prepararPedido.isPending || totalFinal === 0) return;
    const ok = await guardarPedido();
    if (!ok) return;
    if (canGoNext && pedidoIds && onNavigate) {
      onNavigate(pedidoIds[currentIndex + 1]);
    } else {
      // Último pedido: cerrar el diálogo, igual que el botón Guardar
      onOpenChange(false);
    }
  }, [canGoNext, pedidoIds, onNavigate, prepararPedido.isPending, totalFinal, guardarPedido, currentIndex, onOpenChange]);

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

  const handleGuardar = async () => {
    const resultado = await guardarPedido();
    if (resultado) onOpenChange(false);
  };

  const handleImprimirBorrador = () => {
    if (!pedido) return;
    imprimirRemito({
      numeroPedido: pedido.numero_pedido,
      fecha: new Date(pedido.fecha_pedido),
      cliente: {
        nombre: pedido.cliente?.nombre || 'Cliente',
        codigoCliente: pedido.cliente?.codigo_cliente || undefined,
        direccion: pedido.cliente?.direccion || '',
        cuit: pedido.cliente?.dni_cuit || '',
        zona: pedido.cliente?.zona?.nombre || undefined,
      },
      vendedor: undefined,
      condicionVenta: 'Borrador',
      total: totalFinal,
      empresa: config
        ? {
            razonSocial: config.nombre_fantasia || config.razon_social,
            cuit: config.cuit,
            direccion: config.direccion,
            telefono: config.telefono || undefined,
          }
        : undefined,
      lineas: lineas.filter((l) => l.productoId).map((l) => ({
        codigo: l.codigo,
        descripcion: l.descripcion,
        unidadMedida: l.unidadMedida,
        cantidad: l.cantidadPreparada,
        precioUnitario: l.precioUnitario,
        descuento: l.descuentoPorcentaje,
        subtotal: l.subtotal,
      })),
    });
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
              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                disabled={prepararPedido.isPending || totalFinal === 0}
                title={canGoNext ? 'Siguiente pedido (Av Pág)' : 'Guardar y cerrar (Av Pág)'}
              >
                {canGoNext ? 'Siguiente' : 'Guardar y cerrar'}
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
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">Agregar producto</p>
                  <p className="text-xs text-muted-foreground">Buscá por código o descripción para sumarlo al pedido.</p>
                </div>
                 {pedido?.estado === 'pendiente' && (
                  <Button variant="outline" onClick={handleImprimirBorrador}>
                    <Printer className="mr-2 h-4 w-4" />
                     Imprimir pedido
                  </Button>
                )}
              </div>
              <div className="relative">
                <Input
                  placeholder="Buscar producto..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                />
                {productosFiltrados.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
                    {productosFiltrados.map((producto) => (
                      <button
                        key={producto.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                        onClick={() => agregarProducto(producto)}
                      >
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{producto.codigo_articulo}</p>
                          <p className="text-sm font-medium">{producto.descripcion}</p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {lineas.map((linea) => {
              const esPorPeso = isProductoPorPeso(linea.unidadMedida);
              const esMenor = linea.cantidadPreparada < linea.cantidadPedida;
              const esMayor = linea.cantidadPreparada > linea.cantidadPedida;
              const hayDiferencia = esMenor || esMayor;
              
              return (
                <div 
                  key={linea.detalleId}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    esMayor ? 'border-primary bg-primary/5' : 
                    esMenor ? 'border-warning bg-warning/10' : 
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
                          {esMayor && <Badge className="text-xs bg-primary text-primary-foreground">+Mayor</Badge>}
                          {esMenor && <Badge className="text-xs bg-warning text-warning-foreground">-Menor</Badge>}
                          {linea.esNuevo && <Badge variant="outline" className="text-xs">Nuevo</Badge>}
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
                            type="text"
                            inputMode="decimal"
                            value={linea.descuentoPorcentaje === 0 ? '' : String(linea.descuentoPorcentaje)}
                            placeholder="0"
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
                              esMayor ? 'border-primary bg-primary/5' :
                              esMenor ? 'border-warning bg-warning/10' : ''
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
                          esMayor ? 'text-primary' : esMenor ? 'text-warning' : ''
                        }`}>
                          {formatCurrency(linea.subtotal)}
                        </p>
                        <Button variant="ghost" size="sm" className="mt-2" onClick={() => eliminarLinea(linea.detalleId)}>
                          <Trash2 className="mr-1 h-4 w-4" />
                          Eliminar
                        </Button>
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
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
              <div className="text-sm">
                <p className="font-medium text-warning">Preparación parcial</p>
                <p className="text-warning/80">
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
                <p className={`text-2xl font-bold ${hayDiferencias ? 'text-warning' : 'text-primary'}`}>
                  {formatCurrency(totalFinal)}
                </p>
                {hayDiferencias && (
                  <p className="text-xs text-muted-foreground">
                    Diferencia: {formatCurrency(totalFinal - (pedido?.total || 0))}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} size="lg">
                Cancelar
              </Button>
              <Button 
                variant="outline"
                onClick={handleGuardar}
                disabled={prepararPedido.isPending || totalFinal === 0}
                size="lg"
              >
                {prepararPedido.isPending ? (
                  <>Guardando...</>
                ) : (
                  <>Guardar</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
