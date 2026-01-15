import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfiguracionComercio } from '@/hooks/useConfiguracionComercio';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  User,
  CreditCard,
  Printer,
  X,
  FileText,
  ClipboardList,
  Edit,
  Check,
  Scale
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface Producto {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  stock_actual: number;
  unidad_medida: string;
  precio_costo: number;
  marca_id?: string | null;
  tipo_producto_id?: string | null;
}

interface ListaPrecio {
  id: string;
  nombre: string;
  codigo?: string | null;
  orden?: number;
  activo?: boolean;
}

interface PorcentajeMatriz {
  id: string;
  lista_precio_id: string;
  marca_id: string | null;
  tipo_producto_id: string | null;
  es_general: boolean;
  porcentaje: number;
}

interface ExcepcionProducto {
  id: string;
  lista_precio_id: string | null;
  producto_id: string;
  porcentaje: number;
}

interface Cliente {
  id: string;
  nombre: string;
  dni_cuit: string | null;
  condicion_iva?: number;
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

const TIPOS_COMPROBANTE = [
  { value: 1, label: "Factura A", descripcion: "Para Resp. Inscriptos" },
  { value: 6, label: "Factura B", descripcion: "Para Cons. Final / Monotrib." },
];

const TIPOS_DOCUMENTO = [
  { value: 80, label: "CUIT" },
  { value: 86, label: "CUIL" },
  { value: 96, label: "DNI" },
  { value: 99, label: "Consumidor Final" },
];

const CONDICIONES_IVA = [
  { value: 1, label: "IVA Responsable Inscripto" },
  { value: 4, label: "IVA Sujeto Exento" },
  { value: 5, label: "Consumidor Final" },
  { value: 6, label: "Responsable Monotributo" },
];

export default function POS() {
  const { user } = useAuth();
  const { config: comercioConfig, formatCuit } = useConfiguracionComercio();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([]);
  const [matrizPorcentajes, setMatrizPorcentajes] = useState<PorcentajeMatriz[]>([]);
  const [excepciones, setExcepciones] = useState<ExcepcionProducto[]>([]);
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
  
  // Facturación
  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const [emitirFactura, setEmitirFactura] = useState(false);
  const [facturaData, setFacturaData] = useState({
    tipo_comprobante: 6, // Factura B default
    doc_tipo: 99,
    doc_nro: "",
    condicion_iva_receptor: 5, // Consumidor Final
  });
  const [emitiendo, setEmitiendo] = useState(false);
  
  // Pedidos
  const [pedidosDialogOpen, setPedidosDialogOpen] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  
  // Peso para productos por KG
  const [pesoDialogOpen, setPesoDialogOpen] = useState(false);
  const [editingPesoItem, setEditingPesoItem] = useState<string | null>(null);
  const [pesoInput, setPesoInput] = useState('');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [productosRes, clientesRes, formasPagoRes, listasRes, porcentajesRes, excepcionesRes, cajasRes] = await Promise.all([
        supabase.from('productos').select('id, codigo_articulo, descripcion, stock_actual, unidad_medida, precio_costo, marca_id, tipo_producto_id').eq('activo', true).order('descripcion'),
        supabase.from('clientes').select('id, nombre, dni_cuit, condicion_iva, lista_precio_id').eq('activo', true).order('nombre'),
        supabase.from('formas_pago').select('id, nombre').eq('activo', true),
        supabase.from('listas_precios').select('id, nombre, codigo, orden, activo').eq('activo', true).order('orden'),
        supabase.from('lista_precio_porcentajes').select('*'),
        supabase.from('lista_precio_excepciones').select('id, lista_precio_id, producto_id, porcentaje'),
        supabase.from('cajas').select('id').eq('usuario_id', user.id).eq('estado', 'abierta').maybeSingle(),
      ]);

      if (productosRes.data) setProductos(productosRes.data);
      if (clientesRes.data) setClientes(clientesRes.data as Cliente[]);
      if (formasPagoRes.data) setFormasPago(formasPagoRes.data);
      if (porcentajesRes.data) setMatrizPorcentajes(porcentajesRes.data as PorcentajeMatriz[]);
      if (excepcionesRes.data) setExcepciones(excepcionesRes.data as ExcepcionProducto[]);
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

  // Calcular precio de venta usando el nuevo sistema matricial
  // Prioridad: Excepción > Marca > Tipo de Producto > General
  const getProductoPrice = (producto: Producto): number => {
    if (!selectedLista) return 0;
    const costo = producto.precio_costo || 0;
    
    // 1. Buscar excepción específica del producto
    const excepcion = excepciones.find(e => 
      e.producto_id === producto.id && 
      (e.lista_precio_id === selectedLista.id || e.lista_precio_id === null)
    );
    if (excepcion) {
      return costo * (1 + excepcion.porcentaje / 100);
    }
    
    // 2. Buscar por MARCA del producto (PRIORIDAD ALTA)
    if (producto.marca_id) {
      const porMarca = matrizPorcentajes.find(p => 
        p.lista_precio_id === selectedLista.id && 
        p.marca_id === producto.marca_id
      );
      if (porMarca) {
        return costo * (1 + porMarca.porcentaje / 100);
      }
    }
    
    // 3. Buscar por TIPO DE PRODUCTO (PRIORIDAD MEDIA)
    if (producto.tipo_producto_id) {
      const porTipo = matrizPorcentajes.find(p => 
        p.lista_precio_id === selectedLista.id && 
        p.tipo_producto_id === producto.tipo_producto_id
      );
      if (porTipo) {
        return costo * (1 + porTipo.porcentaje / 100);
      }
    }
    
    // 4. Usar porcentaje GENERAL (FALLBACK)
    const general = matrizPorcentajes.find(p => 
      p.lista_precio_id === selectedLista.id && 
      p.es_general === true
    );
    if (general) {
      return costo * (1 + general.porcentaje / 100);
    }
    
    return costo; // Sin margen si no hay configuración
  };

  // Función para verificar si un producto es por peso
  const isProductoPorPeso = (producto: Producto) => {
    const unidad = (producto.unidad_medida || '').toUpperCase().replace('.', '').trim();
    return unidad === 'KG' || unidad === 'KILO' || unidad === 'KILOS';
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
        // Para productos por peso, abrir diálogo en lugar de sumar 1
        if (isProductoPorPeso(producto)) {
          setEditingPesoItem(producto.id);
          setPesoInput(existing.cantidad.toString().replace('.', ','));
          setPesoDialogOpen(true);
          return prev;
        }
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio }
            : item
        );
      }
      // Para productos por peso, agregamos con cantidad 1 y abrimos diálogo para ajustar
      if (isProductoPorPeso(producto)) {
        const newCart = [...prev, { producto, cantidad: 1, precio, subtotal: precio }];
        // Programamos la apertura del diálogo para después de actualizar el estado
        setTimeout(() => {
          setEditingPesoItem(producto.id);
          setPesoInput('1');
          setPesoDialogOpen(true);
        }, 0);
        return newCart;
      }
      return [...prev, { producto, cantidad: 1, precio, subtotal: precio }];
    });
    setSearchTerm('');
  };

  const updateCantidadDirecta = (productoId: string, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      removeFromCart(productoId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.producto.id === productoId) {
          return { ...item, cantidad: nuevaCantidad, subtotal: nuevaCantidad * item.precio };
        }
        return item;
      })
    );
  };

  const handleGuardarPeso = () => {
    if (!editingPesoItem) return;
    
    // Permitir coma o punto como separador decimal
    const pesoNormalizado = pesoInput.replace(',', '.');
    const peso = parseFloat(pesoNormalizado);
    
    if (isNaN(peso) || peso <= 0) {
      toast.error('Ingrese un peso válido');
      return;
    }
    
    updateCantidadDirecta(editingPesoItem, peso);
    setPesoDialogOpen(false);
    setEditingPesoItem(null);
    setPesoInput('');
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

  // Abrir diálogo de facturación antes de procesar
  const handleOpenFacturaDialog = () => {
    // Pre-fill data from selected cliente
    if (selectedCliente) {
      const docTipo = selectedCliente.dni_cuit?.length === 11 ? 80 : 96; // CUIT o DNI
      setFacturaData({
        tipo_comprobante: 6,
        doc_tipo: docTipo,
        doc_nro: selectedCliente.dni_cuit || "",
        condicion_iva_receptor: selectedCliente.condicion_iva || 5,
      });
    } else {
      setFacturaData({
        tipo_comprobante: 6,
        doc_tipo: 99,
        doc_nro: "0",
        condicion_iva_receptor: 5,
      });
    }
    setEmitirFactura(false);
    setFacturaDialogOpen(true);
  };

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

    setEmitiendo(true);

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
        setEmitiendo(false);
        return;
      }

      let venta: any;

      if (editingPedidoId) {
        // Actualizar pedido existente a venta confirmada
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            cliente_id: selectedCliente?.id || null,
            caja_id: caja.id,
            subtotal: total,
            total: total,
            estado: 'confirmada',
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;
        
        // Fetch the updated venta
        const { data: updatedVenta, error: fetchError } = await supabase
          .from('ventas')
          .select('*')
          .eq('id', editingPedidoId)
          .single();
          
        if (fetchError) throw fetchError;
        venta = updatedVenta;

        // Eliminar detalles anteriores
        await supabase
          .from('venta_detalles')
          .delete()
          .eq('venta_id', editingPedidoId);

        // Crear nuevos detalles
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
      } else {
        // Create new venta
        const { data: newVenta, error: ventaError } = await supabase
          .from('ventas')
          .insert([{
            usuario_id: user.id,
            cliente_id: selectedCliente?.id || null,
            caja_id: caja.id,
            subtotal: total,
            descuento: 0,
            total: total,
            estado: 'confirmada',
          }])
          .select()
          .single();

        if (ventaError) throw ventaError;
        venta = newVenta;

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
      }

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
        .maybeSingle();

      await supabase
        .from('cajas')
        .update({ total_ventas: (cajaData?.total_ventas || 0) + total })
        .eq('id', caja.id);

      // Emit AFIP invoice if requested
      let facturaInfo = null;
      if (emitirFactura) {
        try {
          // Calculate IVA (21% assumed)
          const netoSinIva = total / 1.21;
          const ivaAmount = total - netoSinIva;

          const { data: facturaResult, error: facturaError } = await supabase.functions.invoke(
            'afip-facturacion/emitir',
            {
              body: {
                tipo_comprobante: facturaData.tipo_comprobante,
                punto_venta: comercioConfig?.punto_venta || 1,
                concepto: 1,
                doc_tipo: facturaData.doc_tipo,
                doc_nro: parseInt(facturaData.doc_nro) || 0,
                condicion_iva_receptor: facturaData.condicion_iva_receptor,
                importe_total: total,
                importe_neto: parseFloat(netoSinIva.toFixed(2)),
                importe_iva: parseFloat(ivaAmount.toFixed(2)),
                items: cart.map(item => ({
                  descripcion: item.producto.descripcion,
                  cantidad: item.cantidad,
                  precio_unitario: item.precio / 1.21, // Precio sin IVA
                  iva_id: 5, // 21%
                })),
                venta_id: venta.id,
              },
            }
          );

          if (facturaError) {
            console.error('Error AFIP:', facturaError);
            toast.error('Error al emitir factura AFIP: ' + facturaError.message);
          } else if (facturaResult?.error) {
            console.error('Error AFIP:', facturaResult.error);
            toast.error('Error AFIP: ' + facturaResult.error);
          } else {
            facturaInfo = facturaResult;
            
            // Guardar comprobante en la base de datos para que aparezca en Facturación
            const formatFechaAfip = (fecha: string): string => {
              if (fecha && fecha.length === 8) {
                return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
              }
              return fecha || new Date().toISOString().split('T')[0];
            };
            
            const { error: insertComprobanteError } = await supabase
              .from('comprobantes_afip')
              .insert({
                tipo_comprobante: facturaData.tipo_comprobante,
                punto_venta: facturaResult.punto_venta,
                numero_comprobante: facturaResult.numero_comprobante,
                cae: facturaResult.cae,
                cae_vencimiento: formatFechaAfip(facturaResult.cae_vencimiento),
                cuit_emisor: comercioConfig?.cuit?.replace(/\D/g, '') || '',
                doc_tipo: facturaData.doc_tipo,
                doc_nro: parseInt(facturaData.doc_nro) || 0,
                importe_total: total,
                importe_neto: parseFloat(netoSinIva.toFixed(2)),
                importe_iva: parseFloat(ivaAmount.toFixed(2)),
                usuario_id: user.id,
                venta_id: venta.id,
              });
            
            if (insertComprobanteError) {
              console.error('Error guardando comprobante:', insertComprobanteError);
            }
            
            toast.success(`Factura emitida - CAE: ${facturaResult.cae}`);
          }
        } catch (facturaErr: any) {
          console.error('Error emitting factura:', facturaErr);
          toast.error('Error al emitir factura: ' + facturaErr.message);
        }
      }

      setLastVenta({ ...venta, detalles: cart, pagos, cliente: selectedCliente, factura: facturaInfo });
      
      // Clear cart and show ticket
      setCart([]);
      setPagos([]);
      setSelectedCliente(null);
      setEditingPedidoId(null);
      setPagoDialogOpen(false);
      setFacturaDialogOpen(false);
      setTicketDialogOpen(true);
      
      toast.success('Venta procesada correctamente');
      fetchData(); // Refresh stock
      fetchPedidos(); // Refresh pending orders list
    } catch (error) {
      console.error('Error processing sale:', error);
      toast.error('Error al procesar la venta');
    } finally {
      setEmitiendo(false);
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

  // Cargar pedidos pendientes
  const fetchPedidos = async () => {
    if (!user) return;
    setLoadingPedidos(true);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          clientes(id, nombre, dni_cuit, condicion_iva),
          venta_detalles(*, productos(id, codigo_articulo, descripcion, stock_actual, unidad_medida, precio_costo))
        `)
        .eq('estado', 'pedido')
        .eq('anulada', false)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error('Error fetching pedidos:', error);
      toast.error('Error al cargar los pedidos');
    } finally {
      setLoadingPedidos(false);
    }
  };

  // Guardar como pedido
  const handleGuardarPedido = async () => {
    if (!user) return;
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setGuardandoPedido(true);

    try {
      if (editingPedidoId) {
        // Actualizar pedido existente
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            cliente_id: selectedCliente?.id || null,
            subtotal: total,
            total: total,
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;

        // Eliminar detalles anteriores
        await supabase
          .from('venta_detalles')
          .delete()
          .eq('venta_id', editingPedidoId);

        // Insertar nuevos detalles
        const detalles = cart.map((item) => ({
          venta_id: editingPedidoId,
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

        toast.success('Pedido actualizado correctamente');
        setEditingPedidoId(null);
      } else {
        // Crear nuevo pedido
        const { data: pedido, error: pedidoError } = await supabase
          .from('ventas')
          .insert([{
            usuario_id: user.id,
            cliente_id: selectedCliente?.id || null,
            subtotal: total,
            descuento: 0,
            total: total,
            estado: 'pedido',
          }])
          .select()
          .single();

        if (pedidoError) throw pedidoError;

        // Crear detalles
        const detalles = cart.map((item) => ({
          venta_id: pedido.id,
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

        toast.success(`Pedido #${pedido.numero_comprobante} guardado correctamente`);
      }

      // Limpiar carrito
      setCart([]);
      setSelectedCliente(null);
    } catch (error) {
      console.error('Error saving pedido:', error);
      toast.error('Error al guardar el pedido');
    } finally {
      setGuardandoPedido(false);
    }
  };

  // Cargar pedido para editar
  const handleCargarPedido = (pedido: any) => {
    // Cargar cliente
    if (pedido.clientes) {
      setSelectedCliente({
        id: pedido.clientes.id,
        nombre: pedido.clientes.nombre,
        dni_cuit: pedido.clientes.dni_cuit,
        condicion_iva: pedido.clientes.condicion_iva,
      });
    } else {
      setSelectedCliente(null);
    }

    // Cargar items al carrito
    const cartItems: CartItem[] = pedido.venta_detalles.map((detalle: any) => ({
      producto: {
        id: detalle.productos.id,
        codigo_articulo: detalle.productos.codigo_articulo,
        descripcion: detalle.productos.descripcion,
        stock_actual: detalle.productos.stock_actual,
        unidad_medida: detalle.productos.unidad_medida,
        precio_costo: detalle.productos.precio_costo,
      },
      cantidad: detalle.cantidad,
      precio: detalle.precio_unitario,
      subtotal: detalle.subtotal,
    }));

    setCart(cartItems);
    setEditingPedidoId(pedido.id);
    setPedidosDialogOpen(false);
    toast.info(`Pedido #${pedido.numero_comprobante} cargado para edición`);
  };

  // Eliminar pedido
  const handleEliminarPedido = async (pedidoId: string) => {
    try {
      // Primero eliminar detalles
      await supabase
        .from('venta_detalles')
        .delete()
        .eq('venta_id', pedidoId);

      // Luego eliminar el pedido (marcar como anulado ya que no se puede DELETE)
      await supabase
        .from('ventas')
        .update({ anulada: true, motivo_anulacion: 'Pedido cancelado' })
        .eq('id', pedidoId);

      toast.success('Pedido eliminado');
      fetchPedidos();
    } catch (error) {
      console.error('Error deleting pedido:', error);
      toast.error('Error al eliminar el pedido');
    }
  };

  // Imprimir pedido
  const handleImprimirPedido = (pedido: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pedido #${pedido.numero_comprobante}</title>
        <style>
          body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { font-weight: bold; margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PEDIDO</h2>
          <p>#${String(pedido.numero_comprobante).padStart(8, '0')}</p>
          <p>${new Date(pedido.fecha).toLocaleString('es-AR')}</p>
        </div>
        <p><strong>Cliente:</strong> ${pedido.clientes?.nombre || 'Consumidor Final'}</p>
        <hr>
        ${pedido.venta_detalles.map((d: any) => `
          <div class="item">
            <span>${d.cantidad}x ${d.productos?.descripcion?.substring(0, 20) || 'Producto'}</span>
            <span>$${d.subtotal.toLocaleString('es-AR')}</span>
          </div>
        `).join('')}
        <div class="item total">
          <span>TOTAL</span>
          <span>$${pedido.total.toLocaleString('es-AR')}</span>
        </div>
        <div class="footer">
          <p>*** PEDIDO PENDIENTE ***</p>
          <p>Verificar stock antes de facturar</p>
        </div>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
                        {lista.nombre}
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
                    {cart.map((item) => {
                      const esPorPeso = isProductoPorPeso(item.producto);
                      return (
                        <div
                          key={item.producto.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{item.producto.descripcion}</p>
                              {esPorPeso && (
                                <Badge variant="outline" className="text-xs">
                                  <Scale className="h-3 w-3 mr-1" />
                                  KG
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })} x {esPorPeso ? item.cantidad.toLocaleString('es-AR', { minimumFractionDigits: 3 }) + ' kg' : item.cantidad}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {esPorPeso ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3"
                                onClick={() => {
                                  setEditingPesoItem(item.producto.id);
                                  setPesoInput(item.cantidad.toString().replace('.', ','));
                                  setPesoDialogOpen(true);
                                }}
                              >
                                <Scale className="h-4 w-4 mr-1" />
                                {item.cantidad.toLocaleString('es-AR', { minimumFractionDigits: 3 })} kg
                              </Button>
                            ) : (
                              <>
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
                              </>
                            )}
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
                      );
                    })}
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
          <div className="space-y-2">
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

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={cart.length === 0}
                onClick={handleGuardarPedido}
              >
                {guardandoPedido ? (
                  'Guardando...'
                ) : editingPedidoId ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Actualizar
                  </>
                ) : (
                  <>
                    <ClipboardList className="mr-1 h-4 w-4" />
                    Pedido
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  fetchPedidos();
                  setPedidosDialogOpen(true);
                }}
              >
                <Edit className="mr-1 h-4 w-4" />
                Ver Pedidos
              </Button>
            </div>

            {editingPedidoId && (
              <div className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/30 rounded text-sm">
                <span className="text-amber-600 dark:text-amber-400">Editando pedido</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => {
                    setEditingPedidoId(null);
                    setCart([]);
                    setSelectedCliente(null);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

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
              <Button onClick={handleOpenFacturaDialog} disabled={totalPagado < total}>
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket/Factura Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className={lastVenta?.factura ? "max-w-2xl" : ""}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lastVenta?.factura ? <FileText className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
              {lastVenta?.factura ? 'Factura Electrónica' : 'Ticket de Venta'}
            </DialogTitle>
          </DialogHeader>
          {lastVenta && (
            <div id="printable-invoice" className="space-y-4">
              {lastVenta.factura ? (
                // FACTURA FORMAL
                <div className="border rounded-lg p-6 text-sm">
                  {/* Header */}
                  <div className="grid grid-cols-2 gap-4 border-b pb-4">
                    <div>
                      <p className="font-bold text-lg">{comercioConfig?.nombre_fantasia || comercioConfig?.razon_social || 'EMPRESA'}</p>
                      <p className="text-muted-foreground">{comercioConfig?.razon_social || 'Razón Social'}</p>
                      <p className="text-muted-foreground text-xs mt-1">{comercioConfig?.direccion || 'Dirección'}</p>
                      <p className="text-xs text-muted-foreground">CUIT: {formatCuit(comercioConfig?.cuit || '')}</p>
                      <p className="text-xs text-muted-foreground">{comercioConfig?.condicion_iva || 'IVA Responsable Inscripto'}</p>
                    </div>
                    <div className="text-right">
                      <div className="inline-block border-2 border-foreground px-4 py-2 mb-2">
                        <p className="font-bold text-2xl">
                          {lastVenta.factura.tipo_comprobante === 1 ? 'A' : 
                           lastVenta.factura.tipo_comprobante === 6 ? 'B' : 'C'}
                        </p>
                      </div>
                      <p className="font-bold">
                        FACTURA {lastVenta.factura.tipo_comprobante === 1 ? 'A' : 
                                 lastVenta.factura.tipo_comprobante === 6 ? 'B' : 'C'}
                      </p>
                      <p className="text-lg font-mono">
                        Nº {String(lastVenta.factura.punto_venta).padStart(4, '0')}-
                        {String(lastVenta.factura.numero_comprobante).padStart(8, '0')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Fecha: {new Date(lastVenta.fecha).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="py-3 border-b">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente:</p>
                        <p className="font-medium">{lastVenta.cliente?.nombre || 'Consumidor Final'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">CUIT/DNI:</p>
                        <p>{lastVenta.cliente?.dni_cuit || 'S/D'}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Condición IVA:</p>
                      <p>{CONDICIONES_IVA.find(c => c.value === facturaData.condicion_iva_receptor)?.label || 'Consumidor Final'}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="py-3 border-b">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1">Cant.</th>
                          <th className="text-left py-1">Descripción</th>
                          <th className="text-right py-1">P. Unit.</th>
                          <th className="text-right py-1">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastVenta.detalles.map((item: CartItem, idx: number) => (
                          <tr key={idx} className="border-b border-dashed">
                            <td className="py-1">{item.cantidad}</td>
                            <td className="py-1">{item.producto.descripcion}</td>
                            <td className="text-right py-1">
                              ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right py-1">
                              ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="py-3 border-b">
                    <div className="flex justify-end">
                      <div className="w-64 space-y-1">
                        <div className="flex justify-between">
                          <span>Subtotal Neto:</span>
                          <span>${(lastVenta.total / 1.21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVA 21%:</span>
                          <span>${(lastVenta.total - lastVenta.total / 1.21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-1">
                          <span>TOTAL:</span>
                          <span>${lastVenta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CAE Info */}
                  <div className="pt-3 bg-muted/50 rounded p-3 mt-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-bold">CAE Nº: {lastVenta.factura.cae}</p>
                        <p>Fecha Vto. CAE: {lastVenta.factura.cae_vencimiento}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Comprobante Autorizado</p>
                        <p className="text-muted-foreground">AFIP - Factura Electrónica</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // TICKET SIMPLE
                <div className="font-mono text-sm space-y-4">
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
                        <span>{item.cantidad}x {item.producto.descripcion.substring(0, 25)}</span>
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
                </div>
              )}

              <Button className="w-full" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                {lastVenta.factura ? 'Imprimir Factura' : 'Imprimir Ticket'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={facturaDialogOpen} onOpenChange={setFacturaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Confirmar Venta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                <div>
                  <p className="font-medium">Emitir Factura AFIP</p>
                  <p className="text-sm text-muted-foreground">Generar comprobante electrónico</p>
                </div>
              </div>
              <Switch
                checked={emitirFactura}
                onCheckedChange={setEmitirFactura}
              />
            </div>

            {emitirFactura && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo Comprobante</Label>
                    <Select
                      value={facturaData.tipo_comprobante.toString()}
                      onValueChange={(v) => setFacturaData({ ...facturaData, tipo_comprobante: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_COMPROBANTE.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value.toString()}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Condición IVA</Label>
                    <Select
                      value={facturaData.condicion_iva_receptor.toString()}
                      onValueChange={(v) => setFacturaData({ ...facturaData, condicion_iva_receptor: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDICIONES_IVA.map((cond) => (
                          <SelectItem key={cond.value} value={cond.value.toString()}>
                            {cond.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo Documento</Label>
                    <Select
                      value={facturaData.doc_tipo.toString()}
                      onValueChange={(v) => setFacturaData({ ...facturaData, doc_tipo: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map((doc) => (
                          <SelectItem key={doc.value} value={doc.value.toString()}>
                            {doc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Nro Documento</Label>
                    <Input
                      value={facturaData.doc_nro}
                      onChange={(e) => setFacturaData({ ...facturaData, doc_nro: e.target.value })}
                      placeholder="20123456789"
                    />
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setFacturaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleProcesarVenta} disabled={emitiendo}>
                {emitiendo ? 'Procesando...' : emitirFactura ? 'Confirmar y Facturar' : 'Confirmar Venta'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pedidos Pendientes Dialog */}
      <Dialog open={pedidosDialogOpen} onOpenChange={setPedidosDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Pedidos Pendientes
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {loadingPedidos ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Cargando pedidos...</p>
              </div>
            ) : pedidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mb-2" />
                <p>No hay pedidos pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pedidos.map((pedido) => (
                  <Card key={pedido.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-medium">
                              #{String(pedido.numero_comprobante).padStart(8, '0')}
                            </span>
                            <Badge variant="secondary">Pedido</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(pedido.fecha).toLocaleString('es-AR')}
                          </p>
                          <p className="text-sm mt-1">
                            Cliente: {pedido.clientes?.nombre || 'Consumidor Final'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {pedido.venta_detalles?.length || 0} productos
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            ${pedido.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex gap-1 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImprimirPedido(pedido)}
                              title="Imprimir pedido"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCargarPedido(pedido)}
                              title="Cargar para editar/facturar"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleEliminarPedido(pedido.id)}
                              title="Eliminar pedido"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* Detalle expandido */}
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Productos:</p>
                        <div className="space-y-1">
                          {pedido.venta_detalles?.slice(0, 3).map((d: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="truncate max-w-[200px]">
                                {d.cantidad}x {d.productos?.descripcion || 'Producto'}
                              </span>
                              <span>${d.subtotal.toLocaleString('es-AR')}</span>
                            </div>
                          ))}
                          {pedido.venta_detalles?.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{pedido.venta_detalles.length - 3} productos más...
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      {/* Dialog para ingresar peso */}
      <Dialog open={pesoDialogOpen} onOpenChange={setPesoDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Ingresar Peso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingPesoItem && (
              <p className="text-sm text-muted-foreground">
                {cart.find(i => i.producto.id === editingPesoItem)?.producto.descripcion}
              </p>
            )}
            <div>
              <Label htmlFor="peso">Peso en kilogramos</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="peso"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 2,345"
                  value={pesoInput}
                  onChange={(e) => setPesoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleGuardarPeso();
                    }
                  }}
                  autoFocus
                  className="text-lg"
                />
                <span className="text-muted-foreground font-medium">kg</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use coma o punto como separador decimal
              </p>
            </div>
            {editingPesoItem && pesoInput && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Precio por kg:</span>
                  <span>${cart.find(i => i.producto.id === editingPesoItem)?.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold mt-1">
                  <span>Subtotal:</span>
                  <span>
                    ${(
                      (cart.find(i => i.producto.id === editingPesoItem)?.precio || 0) * 
                      parseFloat(pesoInput.replace(',', '.') || '0')
                    ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPesoDialogOpen(false);
                  setEditingPesoItem(null);
                  setPesoInput('');
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleGuardarPeso}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
