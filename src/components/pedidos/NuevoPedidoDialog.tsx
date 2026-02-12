import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2, AlertTriangle, Sparkles, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCrearPedido, useClienteSaldoVencido, useProductosFrecuentes } from '@/hooks/usePedidos';
import { obtenerPrecioVentaProducto } from '@/lib/precioUtils';

interface CarritoItem {
  producto_id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  stock: number;
  descuento_porcentaje: number;
}

interface NuevoPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NuevoPedidoDialog({ open, onOpenChange }: NuevoPedidoDialogProps) {
  const [clienteId, setClienteId] = useState<string>('');
  const [vendedorId, setVendedorId] = useState<string>('');
  const [fechaEntrega, setFechaEntrega] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const crearPedido = useCrearPedido();
  const { data: saldoVencido } = useClienteSaldoVencido(clienteId || undefined);
  const { data: productosFrecuentes } = useProductosFrecuentes(clienteId || undefined);

  // Queries
  const { data: clientes } = useQuery({
    queryKey: ['clientes-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, codigo_cliente, lista_precio_id')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const { data: vendedores } = useQuery({
    queryKey: ['vendedores-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nombre, codigo')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

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

  const clienteSeleccionado = clientes?.find(c => c.id === clienteId);
  const listaClienteId = clienteSeleccionado?.lista_precio_id || listasPrecios?.listas?.[0]?.id;

  const productosFiltrados = useMemo(() => {
    if (!busquedaProducto || !productos) return [];
    const term = busquedaProducto.toLowerCase();
    return productos.filter(p => 
      p.codigo_articulo.toLowerCase().includes(term) ||
      p.descripcion.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [busquedaProducto, productos]);

  const calcularPrecio = (producto: typeof productos[0]) => {
    if (!listaClienteId || !listasPrecios) return producto.precio_costo;
    
    const resultado = obtenerPrecioVentaProducto(
      {
        id: producto.id,
        precio_costo: producto.precio_costo,
        marca_id: producto.marca_id,
        tipo_producto_id: producto.tipo_producto_id
      },
      listaClienteId,
      listasPrecios.porcentajes || [],
      listasPrecios.excepciones || []
    );
    return resultado.precioVenta;
  };

  const agregarProducto = (producto: typeof productos[0]) => {
    const existente = carrito.find(c => c.producto_id === producto.id);
    if (existente) {
      setCarrito(carrito.map(c => 
        c.producto_id === producto.id 
          ? { ...c, cantidad: c.cantidad + 1 }
          : c
      ));
    } else {
      setCarrito([...carrito, {
        producto_id: producto.id,
        codigo: producto.codigo_articulo,
        descripcion: producto.descripcion,
        cantidad: 1,
        precio_unitario: calcularPrecio(producto),
        stock: producto.stock_actual || 0,
        descuento_porcentaje: 0
      }]);
    }
    setBusquedaProducto('');
  };

  const agregarProductoFrecuente = (frecuente: typeof productosFrecuentes[0]) => {
    const producto = productos?.find(p => p.id === frecuente.producto_id);
    if (producto) {
      agregarProducto(producto);
    }
  };

  const actualizarCantidad = (productoId: string, delta: number) => {
    setCarrito(carrito.map(c => {
      if (c.producto_id === productoId) {
        const nuevaCantidad = Math.max(1, c.cantidad + delta);
        return { ...c, cantidad: nuevaCantidad };
      }
      return c;
    }));
  };

  const actualizarDescuento = (productoId: string, valor: string) => {
    const num = parseFloat(valor);
    if (isNaN(num) || num < 0) return;
    const descuento = Math.min(100, num);
    setCarrito(carrito.map(c =>
      c.producto_id === productoId ? { ...c, descuento_porcentaje: descuento } : c
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
    setCarrito(carrito.filter(c => c.producto_id !== productoId));
  };

  const total = carrito.reduce((sum, item) => {
    const subtotal = item.cantidad * item.precio_unitario * (1 - item.descuento_porcentaje / 100);
    return sum + subtotal;
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const handleSubmit = async () => {
    if (!clienteId || carrito.length === 0) return;

    await crearPedido.mutateAsync({
      cliente_id: clienteId,
      vendedor_id: vendedorId || undefined,
      lista_precio_id: listaClienteId,
      fecha_entrega_estimada: fechaEntrega || undefined,
      observaciones: observaciones || undefined,
      detalles: carrito.map(c => ({
        producto_id: c.producto_id,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario,
        descuento_porcentaje: c.descuento_porcentaje
      }))
    });

    // Reset form
    setClienteId('');
    setVendedorId('');
    setFechaEntrega('');
    setObservaciones('');
    setCarrito([]);
    onOpenChange(false);
  };

  const puedeCrear = clienteId && carrito.length > 0 && !saldoVencido?.tieneVencido;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nuevo Pedido / Preventa</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Alerta de saldo vencido */}
          {saldoVencido?.tieneVencido && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este cliente tiene saldo vencido de {formatCurrency(saldoVencido.montoVencido)}. 
                No se pueden crear nuevos pedidos hasta regularizar la situación.
              </AlertDescription>
            </Alert>
          )}

          {/* Cliente y Vendedor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes?.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo_cliente ? `[${c.codigo_cliente}] ` : ''}{c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={vendedorId} onValueChange={setVendedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores?.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      [{v.codigo}] {v.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fecha entrega */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de entrega estimada</Label>
              <Input 
                type="date" 
                value={fechaEntrega} 
                onChange={e => setFechaEntrega(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Productos frecuentes */}
          {clienteId && productosFrecuentes && productosFrecuentes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Productos frecuentes de este cliente
                </Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setMostrarSugerencias(!mostrarSugerencias)}
                >
                  {mostrarSugerencias ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
              {mostrarSugerencias && (
                <div className="flex flex-wrap gap-2">
                  {productosFrecuentes.slice(0, 8).map(pf => (
                    <Badge 
                      key={pf.producto_id}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => agregarProductoFrecuente(pf)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {pf.codigo_articulo} - {pf.producto_nombre.substring(0, 30)}
                      <span className="ml-1 text-xs opacity-70">({pf.veces_comprado}x)</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

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
                        <p className="text-xs text-muted-foreground">Stock: {p.stock_actual || 0}</p>
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
                    <TableRow key={item.producto_id}>
                      <TableCell className="font-mono">{item.codigo}</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => actualizarCantidad(item.producto_id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.cantidad}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => actualizarCantidad(item.producto_id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.precio_unitario}
                          onChange={e => actualizarPrecio(item.producto_id, e.target.value)}
                          className="w-24 text-right h-8 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={item.descuento_porcentaje}
                          onChange={e => actualizarDescuento(item.producto_id, e.target.value)}
                          className="w-20 text-right h-8 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(subtotalItem)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => eliminarProducto(item.producto_id)}
                        >
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

          {/* Observaciones */}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Notas adicionales para el pedido..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex-1">
            <p className="text-lg font-bold">
              Total: {formatCurrency(total)}
            </p>
            <p className="text-sm text-muted-foreground">
              {carrito.length} producto(s)
            </p>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!puedeCrear || crearPedido.isPending}
          >
            {crearPedido.isPending ? 'Creando...' : 'Crear Pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
