import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  User,
  CreditCard,
  Printer,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Producto {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  stock_actual: number;
  unidad_medida: string;
  precio_costo: number;
}

interface ListaPrecio {
  id: string;
  nombre: string;
  porcentaje: number;
}

interface Cliente {
  id: string;
  nombre: string;
  dni_cuit: string | null;
}

interface FormaPago {
  id: string;
  nombre: string;
}

interface CartItem {
  producto: Producto;
  cantidad: number;
  precio: number;
  subtotal: number;
}

interface Pago {
  forma_pago_id: string;
  monto: number;
}

export default function POS() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLista, setSelectedLista] = useState<ListaPrecio | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [lastVenta, setLastVenta] = useState<any>(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [productosRes, clientesRes, formasPagoRes, listasRes, cajasRes] = await Promise.all([
        supabase.from('productos').select('id, codigo_articulo, descripcion, stock_actual, unidad_medida, precio_costo').eq('activo', true).order('descripcion'),
        supabase.from('clientes').select('id, nombre, dni_cuit').eq('activo', true).order('nombre'),
        supabase.from('formas_pago').select('id, nombre').eq('activo', true),
        supabase.from('listas_precios').select('id, nombre, porcentaje').eq('activo', true),
        supabase.from('cajas').select('id').eq('usuario_id', user.id).eq('estado', 'abierta').maybeSingle(),
      ]);

      if (productosRes.data) setProductos(productosRes.data);
      if (clientesRes.data) setClientes(clientesRes.data);
      if (formasPagoRes.data) setFormasPago(formasPagoRes.data);
      if (listasRes.data) {
        setListasPrecios(listasRes.data);
        if (listasRes.data.length > 0 && !selectedLista) {
          setSelectedLista(listasRes.data[0]);
        }
      }
      setCajaAbierta(!!cajasRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const filteredProductos = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return productos.filter(
      (p) =>
        p.codigo_articulo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [productos, searchTerm]);

  // Calcular precio de venta: costo + (costo * porcentaje / 100)
  const getProductoPrice = (producto: Producto) => {
    if (!selectedLista) return 0;
    const costo = producto.precio_costo || 0;
    const porcentaje = selectedLista.porcentaje || 0;
    return costo + (costo * porcentaje / 100);
  };

  const addToCart = (producto: Producto) => {
    const precio = getProductoPrice(producto);
    
    if (producto.precio_costo <= 0) {
      toast.error('Este producto no tiene precio de costo definido');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.producto.id === producto.id);
      if (existing) {
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio }
            : item
        );
      }
      return [...prev, { producto, cantidad: 1, precio, subtotal: precio }];
    });
    setSearchTerm('');
  };

  const updateQuantity = (productoId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.producto.id === productoId) {
            const newCantidad = item.cantidad + delta;
            if (newCantidad <= 0) return null;
            return { ...item, cantidad: newCantidad, subtotal: newCantidad * item.precio };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productoId: string) => {
    setCart((prev) => prev.filter((item) => item.producto.id !== productoId));
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);

  const totalPagado = useMemo(() => pagos.reduce((sum, p) => sum + p.monto, 0), [pagos]);

  const handleProcesarVenta = async () => {
    if (!user) return;

    if (!cajaAbierta) {
      toast.error('Debe abrir una caja antes de realizar ventas');
      return;
    }

    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    if (totalPagado < total) {
      toast.error('El monto pagado es insuficiente');
      return;
    }

    try {
      // Get open cash register
      const { data: caja } = await supabase
        .from('cajas')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('estado', 'abierta')
        .single();

      if (!caja) {
        toast.error('No tiene una caja abierta');
        return;
      }

      // Create venta
      const { data: venta, error: ventaError } = await supabase
        .from('ventas')
        .insert([{
          usuario_id: user.id,
          cliente_id: selectedCliente?.id || null,
          caja_id: caja.id,
          subtotal: total,
          descuento: 0,
          total: total,
        }])
        .select()
        .single();

      if (ventaError) throw ventaError;

      // Create venta_detalles
      const detalles = cart.map((item) => ({
        venta_id: venta.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
        descuento: 0,
        subtotal: item.subtotal,
      }));

      const { error: detallesError } = await supabase
        .from('venta_detalles')
        .insert(detalles);

      if (detallesError) throw detallesError;

      // Create venta_pagos
      const ventaPagos = pagos.map((p) => ({
        venta_id: venta.id,
        forma_pago_id: p.forma_pago_id,
        monto: p.monto,
      }));

      const { error: pagosError } = await supabase
        .from('venta_pagos')
        .insert(ventaPagos);

      if (pagosError) throw pagosError;

      // Update stock
      for (const item of cart) {
        await supabase
          .from('productos')
          .update({ stock_actual: item.producto.stock_actual - item.cantidad })
          .eq('id', item.producto.id);

        // Register inventory movement
        await supabase.from('movimientos_inventario').insert([{
          producto_id: item.producto.id,
          tipo: 'salida',
          cantidad: item.cantidad,
          stock_anterior: item.producto.stock_actual,
          stock_nuevo: item.producto.stock_actual - item.cantidad,
          motivo: 'Venta',
          usuario_id: user.id,
          venta_id: venta.id,
        }]);
      }

      // Register cash movement
      await supabase.from('movimientos_caja').insert([{
        caja_id: caja.id,
        usuario_id: user.id,
        tipo: 'ingreso',
        concepto: `Venta #${venta.numero_comprobante}`,
        monto: total,
        venta_id: venta.id,
      }]);

      // Update caja total
      const { data: cajaData } = await supabase
        .from('cajas')
        .select('total_ventas')
        .eq('id', caja.id)
        .single();

      await supabase
        .from('cajas')
        .update({ total_ventas: (cajaData?.total_ventas || 0) + total })
        .eq('id', caja.id);

      setLastVenta({ ...venta, detalles: cart, pagos, cliente: selectedCliente });
      
      // Clear cart and show ticket
      setCart([]);
      setPagos([]);
      setSelectedCliente(null);
      setPagoDialogOpen(false);
      setTicketDialogOpen(true);
      
      toast.success('Venta procesada correctamente');
      fetchData(); // Refresh stock
    } catch (error) {
      console.error('Error processing sale:', error);
      toast.error('Error al procesar la venta');
    }
  };

  const addPago = (formaPagoId: string) => {
    const pendiente = total - totalPagado;
    if (pendiente <= 0) return;

    setPagos((prev) => {
      const existing = prev.find((p) => p.forma_pago_id === formaPagoId);
      if (existing) {
        return prev.map((p) =>
          p.forma_pago_id === formaPagoId
            ? { ...p, monto: p.monto + pendiente }
            : p
        );
      }
      return [...prev, { forma_pago_id: formaPagoId, monto: pendiente }];
    });
  };

  const removePago = (formaPagoId: string) => {
    setPagos((prev) => prev.filter((p) => p.forma_pago_id !== formaPagoId));
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-2rem)] flex gap-4">
        {/* Left Panel - Product Search */}
        <div className="flex-1 flex flex-col">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Punto de Venta</CardTitle>
                <Select 
                  value={selectedLista?.id || ''} 
                  onValueChange={(id) => {
                    const lista = listasPrecios.find(l => l.id === id);
                    setSelectedLista(lista || null);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Lista de precios" />
                  </SelectTrigger>
                  <SelectContent>
                    {listasPrecios.map((lista) => (
                      <SelectItem key={lista.id} value={lista.id}>
                        {lista.nombre} ({lista.porcentaje}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Buscar producto por código o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {/* Search Results */}
              {filteredProductos.length > 0 && (
                <Card className="absolute z-10 mt-1 w-full max-w-xl shadow-lg">
                  <ScrollArea className="max-h-64">
                    {filteredProductos.map((producto) => (
                      <div
                        key={producto.id}
                        className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                        onClick={() => addToCart(producto)}
                      >
                        <div>
                          <p className="font-medium">{producto.descripcion}</p>
                          <p className="text-sm text-muted-foreground">
                            {producto.codigo_articulo} | Stock: {producto.stock_actual} {producto.unidad_medida}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            ${getProductoPrice(producto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                          <Button size="sm" variant="ghost">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Cart Items */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito ({cart.length} items)
                </CardTitle>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setCart([])}>
                    Vaciar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mb-2" />
                    <p>El carrito está vacío</p>
                    <p className="text-sm">Busque productos para agregar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.producto.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.producto.descripcion}</p>
                          <p className="text-sm text-muted-foreground">
                            ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })} x {item.cantidad}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.producto.id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.cantidad}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.producto.id, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <span className="w-24 text-right font-bold">
                            ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeFromCart(item.producto.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Summary & Payment */}
        <div className="w-80 flex flex-col gap-4">
          {/* Client Selection */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">Cliente</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setClienteDialogOpen(true)}>
                  {selectedCliente ? 'Cambiar' : 'Seleccionar'}
                </Button>
              </div>
              {selectedCliente ? (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p className="font-medium">{selectedCliente.nombre}</p>
                  {selectedCliente.dni_cuit && (
                    <p className="text-sm text-muted-foreground">{selectedCliente.dni_cuit}</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Consumidor Final</p>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Descuento</span>
                  <span>$0.00</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL</span>
                  <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Button */}
          <Button
            size="lg"
            className="w-full"
            disabled={cart.length === 0 || !cajaAbierta}
            onClick={() => {
              setPagos([]);
              setPagoDialogOpen(true);
            }}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Cobrar ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </Button>

          {!cajaAbierta && (
            <p className="text-sm text-destructive text-center">
              Debe abrir una caja para realizar ventas
            </p>
          )}
        </div>
      </div>

      {/* Client Selection Dialog */}
      <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleccionar Cliente</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <div
              className="p-3 hover:bg-muted cursor-pointer rounded"
              onClick={() => {
                setSelectedCliente(null);
                setClienteDialogOpen(false);
              }}
            >
              <p className="font-medium">Consumidor Final</p>
            </div>
            {clientes.map((cliente) => (
              <div
                key={cliente.id}
                className="p-3 hover:bg-muted cursor-pointer rounded border-t"
                onClick={() => {
                  setSelectedCliente(cliente);
                  setClienteDialogOpen(false);
                }}
              >
                <p className="font-medium">{cliente.nombre}</p>
                {cliente.dni_cuit && (
                  <p className="text-sm text-muted-foreground">{cliente.dni_cuit}</p>
                )}
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forma de Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Total a cobrar:</span>
              <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {formasPago.map((fp) => (
                <Button
                  key={fp.id}
                  variant="outline"
                  onClick={() => addPago(fp.id)}
                >
                  {fp.nombre}
                </Button>
              ))}
            </div>

            {pagos.length > 0 && (
              <div className="space-y-2">
                <Separator />
                {pagos.map((pago) => {
                  const fp = formasPago.find((f) => f.id === pago.forma_pago_id);
                  return (
                    <div key={pago.forma_pago_id} className="flex items-center justify-between">
                      <span>{fp?.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ${pago.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removePago(pago.forma_pago_id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total pagado:</span>
                  <span>${totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                {totalPagado >= total && (
                  <div className="flex justify-between text-success">
                    <span>Vuelto:</span>
                    <span>${(totalPagado - total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPagoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleProcesarVenta} disabled={totalPagado < total}>
                Confirmar Venta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Ticket de Venta
            </DialogTitle>
          </DialogHeader>
          {lastVenta && (
            <div className="space-y-4 font-mono text-sm">
              <div className="text-center">
                <p className="font-bold text-lg">TICKET</p>
                <p>Comprobante #{lastVenta.numero_comprobante}</p>
                <p className="text-muted-foreground">
                  {new Date(lastVenta.fecha).toLocaleString('es-AR')}
                </p>
              </div>

              <Separator />

              <div>
                <p className="font-medium">Cliente:</p>
                <p>{lastVenta.cliente?.nombre || 'Consumidor Final'}</p>
              </div>

              <Separator />

              <div>
                {lastVenta.detalles.map((item: CartItem, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.cantidad}x {item.producto.descripcion.substring(0, 20)}</span>
                    <span>${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>TOTAL</span>
                <span>${lastVenta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="text-center text-muted-foreground">
                <p>¡Gracias por su compra!</p>
              </div>

              <Button className="w-full" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Ticket
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
