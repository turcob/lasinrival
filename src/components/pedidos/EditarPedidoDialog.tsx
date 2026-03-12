import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePedido } from '@/hooks/usePedidos';
import { obtenerPrecioVentaProducto } from '@/lib/precioUtils';

interface CarritoItem {
  detalle_id?: string; // existing detail id
  producto_id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  es_nuevo: boolean;
}

interface EditarPedidoDialogProps {
  pedidoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditarPedidoDialog({ pedidoId, open, onOpenChange }: EditarPedidoDialogProps) {
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [eliminados, setEliminados] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pedido, isLoading: loadingPedido } = usePedido(pedidoId || undefined);

  const { data: productos } = useQuery({
    queryKey: ['productos-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productos')
        .select('id, codigo_articulo, descripcion, precio_costo, stock_actual, marca_id, tipo_producto_id')
        .eq('activo', true)
        .order('descripcion');
      if (error) throw error;
      return data;
    },
  });

  const { data: listasPrecios } = useQuery({
    queryKey: ['listas-precios-con-porcentajes'],
    queryFn: async () => {
      const { data: listas, error: listasError } = await supabase
        .from('listas_precios')
        .select('id, nombre, codigo')
        .eq('activo', true);
      if (listasError) throw listasError;
      const { data: porcentajes, error: porcError } = await supabase
        .from('lista_precio_porcentajes')
        .select('*');
      if (porcError) throw porcError;
      const { data: excepciones, error: excError } = await supabase
        .from('lista_precio_excepciones')
        .select('*');
      if (excError) throw excError;
      return { listas, porcentajes, excepciones };
    },
  });

  // Load existing details into cart when pedido loads
  useEffect(() => {
    if (pedido?.detalles && open) {
      setCarrito(
        pedido.detalles.map(d => ({
          detalle_id: d.id,
          producto_id: d.producto_id || '',
          codigo: d.producto?.codigo_articulo || '',
          descripcion: d.producto?.descripcion || '',
          cantidad: d.cantidad_pedida,
          precio_unitario: d.precio_unitario,
          descuento_porcentaje: d.descuento_porcentaje || 0,
          es_nuevo: false,
        }))
      );
      setEliminados([]);
    }
  }, [pedido, open]);

  const calcularPrecio = (producto: NonNullable<typeof productos>[0]) => {
    const listaId = pedido?.lista_precio_id || listasPrecios?.listas?.[0]?.id;
    if (!listaId || !listasPrecios) return producto.precio_costo;
    const resultado = obtenerPrecioVentaProducto(
      { id: producto.id, precio_costo: producto.precio_costo, marca_id: producto.marca_id, tipo_producto_id: producto.tipo_producto_id },
      listaId,
      listasPrecios.porcentajes || [],
      listasPrecios.excepciones || []
    );
    return resultado.precioVenta;
  };

  const productosFiltrados = useMemo(() => {
    if (!busquedaProducto || !productos) return [];
    const term = busquedaProducto.toLowerCase();
    return productos.filter(p =>
      p.codigo_articulo.toLowerCase().includes(term) ||
      p.descripcion.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [busquedaProducto, productos]);

  const agregarProducto = (producto: NonNullable<typeof productos>[0]) => {
    const existente = carrito.find(c => c.producto_id === producto.id);
    if (existente) {
      setCarrito(carrito.map(c =>
        c.producto_id === producto.id ? { ...c, cantidad: c.cantidad + 1 } : c
      ));
    } else {
      setCarrito([...carrito, {
        producto_id: producto.id,
        codigo: producto.codigo_articulo,
        descripcion: producto.descripcion,
        cantidad: 1,
        precio_unitario: calcularPrecio(producto),
        descuento_porcentaje: 0,
        es_nuevo: true,
      }]);
    }
    setBusquedaProducto('');
  };

  const actualizarCantidad = (productoId: string, delta: number) => {
    setCarrito(carrito.map(c => {
      if (c.producto_id === productoId) {
        return { ...c, cantidad: Math.max(1, c.cantidad + delta) };
      }
      return c;
    }));
  };

  const actualizarDescuento = (productoId: string, valor: string) => {
    const num = parseFloat(valor);
    if (isNaN(num) || num < 0) return;
    setCarrito(carrito.map(c =>
      c.producto_id === productoId ? { ...c, descuento_porcentaje: Math.min(100, num) } : c
    ));
  };

  const actualizarPrecio = (productoId: string, valor: string) => {
    const num = parseFloat(valor);
    if (isNaN(num) || num < 0) return;
    setCarrito(carrito.map(c =>
      c.producto_id === productoId ? { ...c, precio_unitario: num } : c
    ));
  };

  const eliminarProducto = (productoId: string) => {
    const item = carrito.find(c => c.producto_id === productoId);
    if (item?.detalle_id) {
      setEliminados([...eliminados, item.detalle_id]);
    }
    setCarrito(carrito.filter(c => c.producto_id !== productoId));
  };

  const total = carrito.reduce((sum, item) => {
    return sum + item.cantidad * item.precio_unitario * (1 - item.descuento_porcentaje / 100);
  }, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  const guardarMutation = useMutation({
    mutationFn: async () => {
      if (!pedidoId || !user) throw new Error('Datos incompletos');

      // Delete removed items
      if (eliminados.length > 0) {
        const { error } = await supabase
          .from('pedido_detalles')
          .delete()
          .in('id', eliminados);
        if (error) throw error;
      }

      // Update existing items
      for (const item of carrito.filter(c => !c.es_nuevo && c.detalle_id)) {
        const subtotal = item.cantidad * item.precio_unitario * (1 - item.descuento_porcentaje / 100);
        const { error } = await supabase
          .from('pedido_detalles')
          .update({
            cantidad_pedida: item.cantidad,
            precio_unitario: item.precio_unitario,
            descuento_porcentaje: item.descuento_porcentaje,
            subtotal,
          })
          .eq('id', item.detalle_id!);
        if (error) throw error;
      }

      // Insert new items
      const nuevos = carrito.filter(c => c.es_nuevo);
      if (nuevos.length > 0) {
        const inserts = nuevos.map(item => ({
          pedido_id: pedidoId,
          producto_id: item.producto_id,
          cantidad_pedida: item.cantidad,
          cantidad_entregada: 0,
          cantidad_devuelta: 0,
          precio_unitario: item.precio_unitario,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.cantidad * item.precio_unitario * (1 - item.descuento_porcentaje / 100),
        }));
        const { error } = await supabase.from('pedido_detalles').insert(inserts);
        if (error) throw error;
      }

      // Update pedido totals
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ subtotal: total, total })
        .eq('id', pedidoId);
      if (updateError) throw updateError;

      // History entry
      await supabase.from('pedido_historial').insert({
        pedido_id: pedidoId,
        estado_anterior: 'pendiente',
        estado_nuevo: 'pendiente',
        usuario_id: user.id,
        observaciones: 'Pedido editado: productos agregados/modificados',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] });
      queryClient.invalidateQueries({ queryKey: ['pedido-historial'] });
      toast({ title: 'Pedido actualizado exitosamente' });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: 'Error al actualizar pedido', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Editar Pedido #{pedido?.numero_pedido?.toString().padStart(6, '0')}
          </DialogTitle>
        </DialogHeader>

        {loadingPedido ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {/* Info cliente */}
              <div className="text-sm text-muted-foreground">
                Cliente: <span className="font-medium text-foreground">{pedido?.cliente?.nombre}</span>
              </div>

              {/* Búsqueda de productos */}
              <div className="space-y-2">
                <Label>Agregar productos</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código o descripción..."
                    value={busquedaProducto}
                    onChange={e => setBusquedaProducto(e.target.value)}
                    className="pl-9"
                  />
                  {productosFiltrados.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                      {productosFiltrados.map(p => (
                        <div
                          key={p.id}
                          className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center"
                          onClick={() => agregarProducto(p)}
                        >
                          <div>
                            <span className="font-mono text-sm">{p.codigo_articulo}</span>
                            <span className="ml-2">{p.descripcion}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(calcularPrecio(p))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Carrito */}
              {carrito.length > 0 && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Dto %</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carrito.map(item => {
                        const subtotalItem = item.cantidad * item.precio_unitario * (1 - item.descuento_porcentaje / 100);
                        return (
                          <TableRow key={item.producto_id} className={item.es_nuevo ? 'bg-green-50/50' : ''}>
                            <TableCell className="font-mono">{item.codigo}</TableCell>
                            <TableCell>{item.descripcion}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => actualizarCantidad(item.producto_id, -1)}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center font-medium">{item.cantidad}</span>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => actualizarCantidad(item.producto_id, 1)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input type="number" step="0.01" min="0" value={item.precio_unitario} onChange={e => actualizarPrecio(item.producto_id, e.target.value)} className="w-24 text-right h-8 ml-auto" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input type="number" step="0.5" min="0" max="100" value={item.descuento_porcentaje} onChange={e => actualizarDescuento(item.producto_id, e.target.value)} className="w-20 text-right h-8 ml-auto" />
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(subtotalItem)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => eliminarProducto(item.producto_id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter className="border-t pt-4">
              <div className="flex-1">
                <p className="text-lg font-bold">Total: {formatCurrency(total)}</p>
                <p className="text-sm text-muted-foreground">{carrito.length} producto(s)</p>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => guardarMutation.mutate()} disabled={carrito.length === 0 || guardarMutation.isPending}>
                {guardarMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
