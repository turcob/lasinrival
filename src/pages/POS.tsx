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
  Scale,
  Percent,
  ChevronDown,
  Package
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ProductSearchModal } from '@/components/pos/ProductSearchModal';
import { ProductQuantityModal } from '@/components/pos/ProductQuantityModal';

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

interface Tarjeta {
  id: string;
  nombre: string;
  tipo: 'credito' | 'debito';
  activo: boolean;
}

interface TarjetaCuota {
  id: string;
  tarjeta_id: string;
  cuotas: number;
  coeficiente: number;
}

interface CartItem {
  id: string; // unique ID for cart item
  producto?: Producto;
  cantidad: number;
  precio: number;
  subtotal: number;
  descuento_porcentaje: number;
  // Producto temporal
  es_temporal?: boolean;
  nombre_temporal?: string;
}

interface Pago {
  forma_pago_id: string;
  monto: number;
  tarjeta_id?: string;
  cuotas?: number;
  coeficiente?: number;
  efectivo_entregado?: number;
  vuelto?: number;
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
  const { user, hasRole } = useAuth();
  const { config: comercioConfig, formatCuit } = useConfiguracionComercio();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([]);
  const [matrizPorcentajes, setMatrizPorcentajes] = useState<PorcentajeMatriz[]>([]);
  const [excepciones, setExcepciones] = useState<ExcepcionProducto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [tarjetaCuotas, setTarjetaCuotas] = useState<TarjetaCuota[]>([]);
  const [configDescuentos, setConfigDescuentos] = useState<{role: string; descuento_maximo_global: number}[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllResults, setShowAllResults] = useState(false);
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
    tipo_comprobante: 6,
    doc_tipo: 99,
    doc_nro: "",
    condicion_iva_receptor: 5,
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
  
  // Edición manual de cantidad
  const [editingCantidadItem, setEditingCantidadItem] = useState<string | null>(null);
  const [cantidadInput, setCantidadInput] = useState('');
  
  // Descuento por item
  const [descuentoDialogOpen, setDescuentoDialogOpen] = useState(false);
  const [editingDescuentoItem, setEditingDescuentoItem] = useState<string | null>(null);
  const [descuentoInput, setDescuentoInput] = useState('');
  
  // Producto temporal
  const [productoTemporalDialogOpen, setProductoTemporalDialogOpen] = useState(false);
  const [productoTemporal, setProductoTemporal] = useState({ nombre: '', precio: '', cantidad: '1' });
  
  // Pago con tarjeta
  const [tarjetaDialogOpen, setTarjetaDialogOpen] = useState(false);
  const [selectedFormaPago, setSelectedFormaPago] = useState<string | null>(null);
  const [selectedTarjeta, setSelectedTarjeta] = useState<string | null>(null);
  const [selectedCuotas, setSelectedCuotas] = useState<number>(1);
  const [montoTarjeta, setMontoTarjeta] = useState('');
  const [tipoTarjetaFiltro, setTipoTarjetaFiltro] = useState<'credito' | 'debito' | null>(null);
  
  // Pago efectivo
  const [efectivoDialogOpen, setEfectivoDialogOpen] = useState(false);
  const [efectivoEntregado, setEfectivoEntregado] = useState('');

  // Modal de búsqueda de productos
  const [productSearchModalOpen, setProductSearchModalOpen] = useState(false);
  const [productQuantityModalOpen, setProductQuantityModalOpen] = useState(false);
  const [selectedProductForQuantity, setSelectedProductForQuantity] = useState<Producto | null>(null);

  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [productosRes, clientesRes, formasPagoRes, listasRes, porcentajesRes, excepcionesRes, cajasRes, tarjetasRes, cuotasRes, descuentosRes] = await Promise.all([
        supabase.from('productos').select('id, codigo_articulo, descripcion, stock_actual, unidad_medida, precio_costo, marca_id, tipo_producto_id').eq('activo', true).order('descripcion'),
        supabase.from('clientes').select('id, nombre, dni_cuit, condicion_iva, lista_precio_id').eq('activo', true).order('nombre'),
        supabase.from('formas_pago').select('id, nombre').eq('activo', true),
        supabase.from('listas_precios').select('id, nombre, codigo, orden, activo').eq('activo', true).order('orden'),
        supabase.from('lista_precio_porcentajes').select('*'),
        supabase.from('lista_precio_excepciones').select('id, lista_precio_id, producto_id, porcentaje'),
        supabase.from('cajas').select('id').eq('usuario_id', user.id).eq('estado', 'abierta').maybeSingle(),
        supabase.from('tarjetas').select('*').eq('activo', true).order('tipo').order('nombre'),
        supabase.from('tarjeta_cuotas').select('*').eq('activo', true).order('cuotas'),
        supabase.from('configuracion_descuentos').select('role, descuento_maximo_global'),
      ]);

      if (productosRes.data) setProductos(productosRes.data);
      if (clientesRes.data) setClientes(clientesRes.data as Cliente[]);
      if (formasPagoRes.data) setFormasPago(formasPagoRes.data);
      if (tarjetasRes.data) setTarjetas(tarjetasRes.data as Tarjeta[]);
      if (cuotasRes.data) setTarjetaCuotas(cuotasRes.data as TarjetaCuota[]);
      if (descuentosRes.data) setConfigDescuentos(descuentosRes.data);
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

  // Obtener descuento máximo permitido para el usuario actual
  const getDescuentoMaximo = (): number => {
    if (isAdmin) return 100;
    // Por ahora usamos el rol más alto del usuario
    const roles = ['encargado', 'cajero', 'vendedor', 'deposito'];
    for (const rol of roles) {
      if (hasRole(rol as any)) {
        const config = configDescuentos.find(c => c.role === rol);
        if (config) return config.descuento_maximo_global;
      }
    }
    return 0;
  };

  const filteredProductos = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const results = productos.filter(
      (p) =>
        p.codigo_articulo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
    );
    return showAllResults ? results : results.slice(0, 8);
  }, [productos, searchTerm, showAllResults]);

  const totalResults = useMemo(() => {
    if (!searchTerm) return 0;
    const term = searchTerm.toLowerCase();
    return productos.filter(
      (p) =>
        p.codigo_articulo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
    ).length;
  }, [productos, searchTerm]);

  const getProductoPrice = (producto: Producto): number => {
    if (!selectedLista) return 0;
    const costo = producto.precio_costo || 0;
    
    const excepcion = excepciones.find(e => 
      e.producto_id === producto.id && 
      (e.lista_precio_id === selectedLista.id || e.lista_precio_id === null)
    );
    if (excepcion) {
      return costo * (1 + excepcion.porcentaje / 100);
    }
    
    if (producto.marca_id) {
      const porMarca = matrizPorcentajes.find(p => 
        p.lista_precio_id === selectedLista.id && 
        p.marca_id === producto.marca_id
      );
      if (porMarca) {
        return costo * (1 + porMarca.porcentaje / 100);
      }
    }
    
    if (producto.tipo_producto_id) {
      const porTipo = matrizPorcentajes.find(p => 
        p.lista_precio_id === selectedLista.id && 
        p.tipo_producto_id === producto.tipo_producto_id
      );
      if (porTipo) {
        return costo * (1 + porTipo.porcentaje / 100);
      }
    }
    
    const general = matrizPorcentajes.find(p => 
      p.lista_precio_id === selectedLista.id && 
      p.es_general === true
    );
    if (general) {
      return costo * (1 + general.porcentaje / 100);
    }
    
    return costo;
  };

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
      const existing = prev.find((item) => item.producto?.id === producto.id && !item.es_temporal);
      if (existing) {
        if (isProductoPorPeso(producto)) {
          setEditingPesoItem(existing.id);
          setPesoInput(existing.cantidad.toString().replace('.', ','));
          setPesoDialogOpen(true);
          return prev;
        }
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, cantidad: item.cantidad + 1, subtotal: calcSubtotal(item.cantidad + 1, item.precio, item.descuento_porcentaje) }
            : item
        );
      }
      const newId = crypto.randomUUID();
      if (isProductoPorPeso(producto)) {
        const newCart = [...prev, { id: newId, producto, cantidad: 1, precio, subtotal: precio, descuento_porcentaje: 0 }];
        setTimeout(() => {
          setEditingPesoItem(newId);
          setPesoInput('1');
          setPesoDialogOpen(true);
        }, 0);
        return newCart;
      }
      return [...prev, { id: newId, producto, cantidad: 1, precio, subtotal: precio, descuento_porcentaje: 0 }];
    });
    setSearchTerm('');
    setShowAllResults(false);
  };

  // Handler para selección de producto desde el modal de búsqueda
  const handleProductSelectedFromModal = (producto: Producto) => {
    if (producto.precio_costo <= 0) {
      toast.error('Este producto no tiene precio de costo definido');
      return;
    }
    setSelectedProductForQuantity(producto);
    setProductQuantityModalOpen(true);
  };

  // Handler para confirmar cantidad desde el modal
  const handleConfirmProductQuantity = (producto: Producto, cantidad: number) => {
    const precio = getProductoPrice(producto);
    
    setCart((prev) => {
      const existing = prev.find((item) => item.producto?.id === producto.id && !item.es_temporal);
      if (existing) {
        const nuevaCantidad = existing.cantidad + cantidad;
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, cantidad: nuevaCantidad, subtotal: calcSubtotal(nuevaCantidad, item.precio, item.descuento_porcentaje) }
            : item
        );
      }
      const newId = crypto.randomUUID();
      return [...prev, { id: newId, producto, cantidad, precio, subtotal: calcSubtotal(cantidad, precio, 0), descuento_porcentaje: 0 }];
    });
    
    toast.success(`${producto.descripcion} agregado al pedido`);
  };

  const calcSubtotal = (cantidad: number, precio: number, descuentoPorcentaje: number): number => {
    const subtotalBruto = cantidad * precio;
    return subtotalBruto * (1 - descuentoPorcentaje / 100);
  };

  const updateCantidadDirecta = (itemId: string, nuevaCantidad: number) => {
    if (nuevaCantidad <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, cantidad: nuevaCantidad, subtotal: calcSubtotal(nuevaCantidad, item.precio, item.descuento_porcentaje) };
        }
        return item;
      })
    );
  };

  const updateDescuento = (itemId: string, descuento: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, descuento_porcentaje: descuento, subtotal: calcSubtotal(item.cantidad, item.precio, descuento) };
        }
        return item;
      })
    );
  };

  const handleGuardarPeso = () => {
    if (!editingPesoItem) return;
    
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

  const handleGuardarCantidad = () => {
    if (!editingCantidadItem) return;
    const cantidad = parseInt(cantidadInput);
    if (isNaN(cantidad) || cantidad < 1) {
      toast.error('Ingrese una cantidad válida');
      return;
    }
    updateCantidadDirecta(editingCantidadItem, cantidad);
    setEditingCantidadItem(null);
    setCantidadInput('');
  };

  const handleGuardarDescuento = () => {
    if (!editingDescuentoItem) return;
    const descuento = parseFloat(descuentoInput.replace(',', '.'));
    const maxDescuento = getDescuentoMaximo();
    
    if (isNaN(descuento) || descuento < 0) {
      toast.error('Ingrese un descuento válido');
      return;
    }
    if (descuento > maxDescuento) {
      toast.error(`El descuento máximo permitido es ${maxDescuento}%`);
      return;
    }
    
    updateDescuento(editingDescuentoItem, descuento);
    setDescuentoDialogOpen(false);
    setEditingDescuentoItem(null);
    setDescuentoInput('');
    toast.success(`Descuento del ${descuento}% aplicado`);
  };

  const handleAgregarProductoTemporal = () => {
    if (!productoTemporal.nombre.trim()) {
      toast.error('Ingrese un nombre para el producto');
      return;
    }
    const precio = parseFloat(productoTemporal.precio.replace(',', '.'));
    if (isNaN(precio) || precio <= 0) {
      toast.error('Ingrese un precio válido');
      return;
    }
    const cantidad = parseInt(productoTemporal.cantidad) || 1;
    
    const newItem: CartItem = {
      id: crypto.randomUUID(),
      cantidad,
      precio,
      subtotal: precio * cantidad,
      descuento_porcentaje: 0,
      es_temporal: true,
      nombre_temporal: productoTemporal.nombre.trim(),
    };
    
    setCart(prev => [...prev, newItem]);
    setProductoTemporalDialogOpen(false);
    setProductoTemporal({ nombre: '', precio: '', cantidad: '1' });
    toast.success('Producto agregado al carrito');
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const newCantidad = item.cantidad + delta;
            if (newCantidad <= 0) return null;
            return { ...item, cantidad: newCantidad, subtotal: calcSubtotal(newCantidad, item.precio, item.descuento_porcentaje) };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.cantidad * item.precio), 0), [cart]);
  const totalDescuentos = useMemo(() => cart.reduce((sum, item) => sum + (item.cantidad * item.precio * item.descuento_porcentaje / 100), 0), [cart]);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
  const totalPagado = useMemo(() => pagos.reduce((sum, p) => sum + p.monto, 0), [pagos]);
  // Total a facturar: si hay pagos con intereses, usar totalPagado; sino usar total de productos
  const totalFacturar = useMemo(() => totalPagado > 0 ? totalPagado : total, [totalPagado, total]);

  const handleOpenFacturaDialog = () => {
    if (selectedCliente) {
      const docTipo = selectedCliente.dni_cuit?.length === 11 ? 80 : 96;
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

  // Agregar pago con tarjeta
  const handleAddPagoTarjeta = () => {
    if (!selectedTarjeta || !selectedFormaPago) return;
    
    const monto = parseFloat(montoTarjeta.replace(',', '.'));
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }
    
    const tarjeta = tarjetas.find(t => t.id === selectedTarjeta);
    
    // Para débito, buscar cualquier coeficiente configurado (no depende de cuotas)
    // Para crédito, buscar por cuotas seleccionadas
    let cuotaConfig;
    let cuotasUsadas = selectedCuotas;
    
    if (tarjeta?.tipo === 'debito') {
      // Para débito, tomar el primer (y único) coeficiente configurado
      cuotaConfig = tarjetaCuotas.find(c => c.tarjeta_id === selectedTarjeta);
      cuotasUsadas = 1; // Débito siempre es 1 cuota
    } else {
      cuotaConfig = tarjetaCuotas.find(c => c.tarjeta_id === selectedTarjeta && c.cuotas === selectedCuotas);
    }
    
    const coeficiente = cuotaConfig?.coeficiente || 1;
    const montoConInteres = monto * coeficiente;
    
    setPagos(prev => [...prev, {
      forma_pago_id: selectedFormaPago,
      monto: montoConInteres,
      tarjeta_id: selectedTarjeta,
      cuotas: cuotasUsadas,
      coeficiente,
    }]);
    
    setTarjetaDialogOpen(false);
    setSelectedTarjeta(null);
    setSelectedCuotas(1);
    setMontoTarjeta('');
    
    if (coeficiente > 1) {
      toast.success(`Pago agregado con ${((coeficiente - 1) * 100).toFixed(1)}% de interés`);
    } else {
      toast.success('Pago con tarjeta agregado');
    }
  };

  // Agregar pago en efectivo
  const handleAddPagoEfectivo = () => {
    const entregado = parseFloat(efectivoEntregado.replace(',', '.'));
    const pendiente = total - totalPagado;
    
    if (isNaN(entregado) || entregado <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }
    
    const montoAplicado = Math.min(entregado, pendiente);
    const vuelto = entregado > pendiente ? entregado - pendiente : 0;
    
    const efectivoFP = formasPago.find(fp => fp.nombre.toLowerCase().includes('efectivo'));
    if (!efectivoFP) {
      toast.error('No se encontró la forma de pago Efectivo');
      return;
    }
    
    setPagos(prev => [...prev, {
      forma_pago_id: efectivoFP.id,
      monto: montoAplicado,
      efectivo_entregado: entregado,
      vuelto,
    }]);
    
    setEfectivoDialogOpen(false);
    setEfectivoEntregado('');
    
    if (vuelto > 0) {
      toast.success(`Vuelto: $${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    }
  };

  const addPago = (formaPagoId: string) => {
    const fp = formasPago.find(f => f.id === formaPagoId);
    const fpNombre = fp?.nombre.toLowerCase() || '';
    
    // Si es efectivo, abrir diálogo de efectivo
    if (fpNombre.includes('efectivo')) {
      setEfectivoDialogOpen(true);
      return;
    }
    
    // Si es débito, abrir diálogo de tarjeta con filtro débito
    if (fpNombre.includes('débito') || fpNombre.includes('debito')) {
      setSelectedFormaPago(formaPagoId);
      setTipoTarjetaFiltro('debito');
      setSelectedTarjeta(null);
      setSelectedCuotas(1);
      const pendiente = total - totalPagado;
      setMontoTarjeta(pendiente.toString());
      setTarjetaDialogOpen(true);
      return;
    }
    
    // Si es crédito, abrir diálogo de tarjeta con filtro crédito
    if (fpNombre.includes('crédito') || fpNombre.includes('credito')) {
      setSelectedFormaPago(formaPagoId);
      setTipoTarjetaFiltro('credito');
      setSelectedTarjeta(null);
      setSelectedCuotas(1);
      const pendiente = total - totalPagado;
      setMontoTarjeta(pendiente.toString());
      setTarjetaDialogOpen(true);
      return;
    }
    
    // Si es tarjeta genérica, mostrar todas
    if (fpNombre.includes('tarjeta')) {
      setSelectedFormaPago(formaPagoId);
      setTipoTarjetaFiltro(null);
      setSelectedTarjeta(null);
      setSelectedCuotas(1);
      const pendiente = total - totalPagado;
      setMontoTarjeta(pendiente.toString());
      setTarjetaDialogOpen(true);
      return;
    }
    
    // Otros métodos de pago
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

  const removePago = (index: number) => {
    setPagos((prev) => prev.filter((_, i) => i !== index));
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
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            cliente_id: selectedCliente?.id || null,
            caja_id: caja.id,
            subtotal: subtotal,
            descuento: totalDescuentos,
            total: totalFacturar,
            estado: 'confirmada',
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;
        
        const { data: updatedVenta, error: fetchError } = await supabase
          .from('ventas')
          .select('*')
          .eq('id', editingPedidoId)
          .single();
          
        if (fetchError) throw fetchError;
        venta = updatedVenta;

        await supabase
          .from('venta_detalles')
          .delete()
          .eq('venta_id', editingPedidoId);

        const detalles = cart.map((item) => ({
          venta_id: venta.id,
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));

        const { error: detallesError } = await supabase
          .from('venta_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;
      } else {
        const { data: newVenta, error: ventaError } = await supabase
          .from('ventas')
          .insert([{
            usuario_id: user.id,
            cliente_id: selectedCliente?.id || null,
            caja_id: caja.id,
            subtotal: subtotal,
            descuento: totalDescuentos,
            total: totalFacturar,
            estado: 'confirmada',
          }])
          .select()
          .single();

        if (ventaError) throw ventaError;
        venta = newVenta;

        const detalles = cart.map((item) => ({
          venta_id: venta.id,
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));

        const { error: detallesError } = await supabase
          .from('venta_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;
      }

      // Create venta_pagos with tarjeta info
      const ventaPagos = pagos.map((p) => ({
        venta_id: venta.id,
        forma_pago_id: p.forma_pago_id,
        monto: p.monto,
        tarjeta_id: p.tarjeta_id || null,
        cuotas: p.cuotas || null,
        coeficiente: p.coeficiente || null,
        efectivo_entregado: p.efectivo_entregado || null,
        vuelto: p.vuelto || null,
      }));

      const { error: pagosError } = await supabase
        .from('venta_pagos')
        .insert(ventaPagos);

      if (pagosError) throw pagosError;

      // Update stock (only for real products)
      for (const item of cart) {
        if (item.producto && !item.es_temporal) {
          await supabase
            .from('productos')
            .update({ stock_actual: item.producto.stock_actual - item.cantidad })
            .eq('id', item.producto.id);

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
      }

      await supabase.from('movimientos_caja').insert([{
        caja_id: caja.id,
        usuario_id: user.id,
        tipo: 'ingreso',
        concepto: `Venta #${venta.numero_comprobante}`,
        monto: totalFacturar,
        venta_id: venta.id,
      }]);

      const { data: cajaData } = await supabase
        .from('cajas')
        .select('total_ventas')
        .eq('id', caja.id)
        .maybeSingle();

      await supabase
        .from('cajas')
        .update({ total_ventas: (cajaData?.total_ventas || 0) + totalFacturar })
        .eq('id', caja.id);

      let facturaInfo = null;
      if (emitirFactura) {
        try {
          const netoSinIva = totalFacturar / 1.21;
          const ivaAmount = totalFacturar - netoSinIva;

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
                importe_total: totalFacturar,
                importe_neto: parseFloat(netoSinIva.toFixed(2)),
                importe_iva: parseFloat(ivaAmount.toFixed(2)),
                items: cart.map(item => ({
                  descripcion: item.es_temporal ? item.nombre_temporal : item.producto?.descripcion,
                  cantidad: item.cantidad,
                  precio_unitario: item.precio / 1.21,
                  iva_id: 5,
                })),
                venta_id: venta.id,
              },
            }
          );

          if (facturaError) {
            toast.error('Error al emitir factura AFIP: ' + facturaError.message);
          } else if (facturaResult?.error) {
            toast.error('Error AFIP: ' + facturaResult.error);
          } else {
            facturaInfo = facturaResult;
            
            const formatFechaAfip = (fecha: string): string => {
              if (fecha && fecha.length === 8) {
                return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
              }
              return fecha || new Date().toISOString().split('T')[0];
            };
            
            await supabase
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
            
            toast.success(`Factura emitida - CAE: ${facturaResult.cae}`);
          }
        } catch (facturaErr: any) {
          toast.error('Error al emitir factura: ' + facturaErr.message);
        }
      }

      setLastVenta({ ...venta, detalles: cart, pagos, cliente: selectedCliente, factura: facturaInfo });
      
      setCart([]);
      setPagos([]);
      setSelectedCliente(null);
      setEditingPedidoId(null);
      setPagoDialogOpen(false);
      setFacturaDialogOpen(false);
      setTicketDialogOpen(true);
      
      toast.success('Venta procesada correctamente');
      fetchData();
      fetchPedidos();
    } catch (error) {
      console.error('Error processing sale:', error);
      toast.error('Error al procesar la venta');
    } finally {
      setEmitiendo(false);
    }
  };

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
      toast.error('Error al cargar los pedidos');
    } finally {
      setLoadingPedidos(false);
    }
  };

  const handleGuardarPedido = async () => {
    if (!user) return;
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setGuardandoPedido(true);

    try {
      if (editingPedidoId) {
        const { error: updateError } = await supabase
          .from('ventas')
          .update({
            cliente_id: selectedCliente?.id || null,
            subtotal: subtotal,
            descuento: totalDescuentos,
            total: total,
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;

        await supabase
          .from('venta_detalles')
          .delete()
          .eq('venta_id', editingPedidoId);

        const detalles = cart.map((item) => ({
          venta_id: editingPedidoId,
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));

        const { error: detallesError } = await supabase
          .from('venta_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;

        toast.success('Pedido actualizado correctamente');
        setEditingPedidoId(null);
      } else {
        const { data: pedido, error: pedidoError } = await supabase
          .from('ventas')
          .insert([{
            usuario_id: user.id,
            cliente_id: selectedCliente?.id || null,
            subtotal: subtotal,
            descuento: totalDescuentos,
            total: total,
            estado: 'pedido',
          }])
          .select()
          .single();

        if (pedidoError) throw pedidoError;

        const detalles = cart.map((item) => ({
          venta_id: pedido.id,
          producto_id: item.producto?.id || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          descuento: item.descuento_porcentaje > 0 ? item.cantidad * item.precio * item.descuento_porcentaje / 100 : 0,
          descuento_porcentaje: item.descuento_porcentaje,
          subtotal: item.subtotal,
          producto_temporal_nombre: item.es_temporal ? item.nombre_temporal : null,
          producto_temporal_precio: item.es_temporal ? item.precio : null,
        }));

        const { error: detallesError } = await supabase
          .from('venta_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;

        toast.success(`Pedido #${pedido.numero_comprobante} guardado correctamente`);
      }

      setCart([]);
      setSelectedCliente(null);
    } catch (error) {
      toast.error('Error al guardar el pedido');
    } finally {
      setGuardandoPedido(false);
    }
  };

  const handleCargarPedido = (pedido: any) => {
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

    const cartItems: CartItem[] = pedido.venta_detalles.map((detalle: any) => {
      if (detalle.producto_temporal_nombre) {
        return {
          id: crypto.randomUUID(),
          cantidad: detalle.cantidad,
          precio: detalle.producto_temporal_precio || detalle.precio_unitario,
          subtotal: detalle.subtotal,
          descuento_porcentaje: detalle.descuento_porcentaje || 0,
          es_temporal: true,
          nombre_temporal: detalle.producto_temporal_nombre,
        };
      }
      return {
        id: crypto.randomUUID(),
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
        descuento_porcentaje: detalle.descuento_porcentaje || 0,
      };
    });

    setCart(cartItems);
    setEditingPedidoId(pedido.id);
    setPedidosDialogOpen(false);
    toast.info(`Pedido #${pedido.numero_comprobante} cargado para edición`);
  };

  const handleEliminarPedido = async (pedidoId: string) => {
    try {
      await supabase
        .from('venta_detalles')
        .delete()
        .eq('venta_id', pedidoId);

      await supabase
        .from('ventas')
        .update({ anulada: true, motivo_anulacion: 'Pedido cancelado' })
        .eq('id', pedidoId);

      toast.success('Pedido eliminado');
      fetchPedidos();
    } catch (error) {
      toast.error('Error al eliminar el pedido');
    }
  };

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
            <span>${d.cantidad}x ${d.producto_temporal_nombre || d.productos?.descripcion?.substring(0, 20) || 'Producto'}</span>
            <span>$${d.subtotal.toLocaleString('es-AR')}</span>
          </div>
        `).join('')}
        <div class="item total">
          <span>TOTAL</span>
          <span>$${pedido.total.toLocaleString('es-AR')}</span>
        </div>
        <div class="footer">
          <p>*** PEDIDO PENDIENTE ***</p>
        </div>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-[calc(100vh-2rem)] flex gap-4">
        {/* Left Panel - Product Search */}
        <div className="flex-1 flex flex-col">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Punto de Venta</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProductoTemporalDialogOpen(true)}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    Producto Libre
                  </Button>
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
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Buscar producto por código o descripción..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowAllResults(false);
                    }}
                  />
                </div>
                <Button 
                  variant="default"
                  onClick={() => setProductSearchModalOpen(true)}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
              
              {/* Quick Search Results - mantener para búsqueda rápida inline */}
              {filteredProductos.length > 0 && searchTerm && (
                <Card className="absolute z-10 mt-1 w-full max-w-xl shadow-lg bg-background">
                  <ScrollArea className="max-h-60">
                    {filteredProductos.slice(0, 4).map((producto) => (
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
                    {totalResults > 4 && (
                      <div 
                        className="p-3 text-center text-primary hover:bg-muted cursor-pointer font-medium"
                        onClick={() => {
                          setProductSearchModalOpen(true);
                          setSearchTerm('');
                        }}
                      >
                        <Search className="h-4 w-4 inline mr-1" />
                        Ver todos los {totalResults} resultados
                      </div>
                    )}
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
                      const esPorPeso = item.producto && isProductoPorPeso(item.producto);
                      const nombreProducto = item.es_temporal ? item.nombre_temporal : item.producto?.descripcion;
                      const totalSinDescuento = item.cantidad * item.precio;
                      const montoDescuento = totalSinDescuento * (item.descuento_porcentaje / 100);
                      const maxDescuento = getDescuentoMaximo();
                      
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-muted/50 rounded-lg border"
                        >
                          {/* Header: Nombre y badges */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                              <p className="font-medium truncate">{nombreProducto}</p>
                              {item.es_temporal && (
                                <Badge variant="secondary" className="text-xs shrink-0">Libre</Badge>
                              )}
                              {esPorPeso && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  <Scale className="h-3 w-3 mr-1" />
                                  KG
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive shrink-0 ml-2"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {/* Tabla de columnas */}
                          <div className="grid grid-cols-6 gap-1 text-xs">
                            {/* Headers */}
                            <div className="text-muted-foreground font-medium text-center">P.Unit</div>
                            <div className="text-muted-foreground font-medium text-center">Cant.</div>
                            <div className="text-muted-foreground font-medium text-center">Subtotal</div>
                            <div className="text-muted-foreground font-medium text-center">Desc.%</div>
                            <div className="text-muted-foreground font-medium text-center">Desc.$</div>
                            <div className="text-muted-foreground font-medium text-center">Total</div>
                            
                            {/* Values */}
                            <div className="text-center py-1">
                              ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-center py-1">
                              <Input
                                type="text"
                                inputMode={esPorPeso ? "decimal" : "numeric"}
                                className="h-6 w-full text-center text-xs p-1 text-foreground"
                                value={editingCantidadItem === item.id ? cantidadInput : (esPorPeso ? item.cantidad.toLocaleString('es-AR', { minimumFractionDigits: 3 }) : item.cantidad.toString())}
                                onFocus={() => {
                                  setEditingCantidadItem(item.id);
                                  setCantidadInput(esPorPeso ? item.cantidad.toString().replace('.', ',') : item.cantidad.toString());
                                }}
                                onChange={(e) => setCantidadInput(e.target.value)}
                                onBlur={() => {
                                  if (editingCantidadItem === item.id) {
                                    const cantidadNormalizada = cantidadInput.replace(',', '.');
                                    const cantidad = parseFloat(cantidadNormalizada);
                                    if (!isNaN(cantidad) && cantidad > 0) {
                                      updateCantidadDirecta(item.id, cantidad);
                                    }
                                    setEditingCantidadItem(null);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const cantidadNormalizada = cantidadInput.replace(',', '.');
                                    const cantidad = parseFloat(cantidadNormalizada);
                                    if (!isNaN(cantidad) && cantidad > 0) {
                                      updateCantidadDirecta(item.id, cantidad);
                                    }
                                    setEditingCantidadItem(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingCantidadItem(null);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                            </div>
                            <div className="text-center py-1">
                              ${totalSinDescuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-center py-1">
                              {maxDescuento > 0 ? (
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  className="h-6 w-full text-center text-xs p-1 text-foreground"
                                  value={editingDescuentoItem === item.id ? descuentoInput : item.descuento_porcentaje.toString()}
                                  onFocus={() => {
                                    setEditingDescuentoItem(item.id);
                                    setDescuentoInput(item.descuento_porcentaje.toString());
                                  }}
                                  onChange={(e) => setDescuentoInput(e.target.value)}
                                  onBlur={() => {
                                    if (editingDescuentoItem === item.id) {
                                      const descuento = parseFloat(descuentoInput.replace(',', '.'));
                                      if (!isNaN(descuento) && descuento >= 0 && descuento <= maxDescuento) {
                                        updateDescuento(item.id, descuento);
                                      } else if (descuento > maxDescuento) {
                                        toast.error(`Máximo permitido: ${maxDescuento}%`);
                                      }
                                      setEditingDescuentoItem(null);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const descuento = parseFloat(descuentoInput.replace(',', '.'));
                                      if (!isNaN(descuento) && descuento >= 0 && descuento <= maxDescuento) {
                                        updateDescuento(item.id, descuento);
                                      } else if (descuento > maxDescuento) {
                                        toast.error(`Máximo permitido: ${maxDescuento}%`);
                                      }
                                      setEditingDescuentoItem(null);
                                      (e.target as HTMLInputElement).blur();
                                    }
                                    if (e.key === 'Escape') {
                                      setEditingDescuentoItem(null);
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-center py-1 text-destructive">
                              {montoDescuento > 0 ? `-$${montoDescuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                            </div>
                            <div className="text-center py-1 font-bold text-primary text-sm">
                              ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </div>
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
                  <span>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                {totalDescuentos > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Descuentos</span>
                    <span>-${totalDescuentos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
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
        <DialogContent className="max-w-lg">
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
                  disabled={totalPagado >= total}
                >
                  {fp.nombre}
                </Button>
              ))}
            </div>

            {pagos.length > 0 && (
              <div className="space-y-2">
                <Separator />
                {pagos.map((pago, index) => {
                  const fp = formasPago.find((f) => f.id === pago.forma_pago_id);
                  const tarjeta = tarjetas.find(t => t.id === pago.tarjeta_id);
                  return (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <span className="font-medium">{fp?.nombre}</span>
                        {tarjeta && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({tarjeta.nombre}
                            {pago.cuotas && pago.cuotas > 1 && ` - ${pago.cuotas} cuotas`}
                            )
                          </span>
                        )}
                        {pago.vuelto && pago.vuelto > 0 && (
                          <p className="text-sm text-success">
                            Entregó: ${pago.efectivo_entregado?.toLocaleString('es-AR')} | Vuelto: ${pago.vuelto.toLocaleString('es-AR')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          ${pago.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removePago(index)}
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
                {totalPagado < total && (
                  <div className="flex justify-between text-destructive">
                    <span>Pendiente:</span>
                    <span>${(total - totalPagado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
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

      {/* Tarjeta Dialog */}
      <Dialog open={tarjetaDialogOpen} onOpenChange={setTarjetaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pago con Tarjeta {tipoTarjetaFiltro === 'debito' ? 'de Débito' : tipoTarjetaFiltro === 'credito' ? 'de Crédito' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Seleccionar Tarjeta</Label>
              <Select value={selectedTarjeta || ''} onValueChange={setSelectedTarjeta}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {tarjetas
                    .filter((t) => !tipoTarjetaFiltro || t.tipo === tipoTarjetaFiltro)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTarjeta && (() => {
              const tarjetaSeleccionada = tarjetas.find(t => t.id === selectedTarjeta);
              const cuotasDisponibles = tarjetaCuotas.filter(c => c.tarjeta_id === selectedTarjeta);
              
              if (cuotasDisponibles.length === 0) return null;
              
              // Para débito, mostrar solo el coeficiente si existe
              if (tarjetaSeleccionada?.tipo === 'debito') {
                const cuotaConfig = cuotasDisponibles[0];
                if (cuotaConfig && cuotaConfig.coeficiente > 1) {
                  const monto = parseFloat(montoTarjeta.replace(',', '.')) || 0;
                  return (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">
                        Interés: <span className="font-medium">+{((cuotaConfig.coeficiente - 1) * 100).toFixed(1)}%</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total a cobrar: ${(monto * cuotaConfig.coeficiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                }
                return null;
              }
              
              // Para crédito, mostrar selector de cuotas
              return (
                <div>
                  <Label>Cuotas</Label>
                  <Select value={selectedCuotas.toString()} onValueChange={(v) => setSelectedCuotas(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cuotasDisponibles.map((c) => (
                        <SelectItem key={c.cuotas} value={c.cuotas.toString()}>
                          {c.cuotas} cuota{c.cuotas > 1 ? 's' : ''} 
                          {c.coeficiente > 1 && ` (+${((c.coeficiente - 1) * 100).toFixed(1)}%)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}

            <div>
              <Label>Monto</Label>
              <Input
                type="text"
                value={montoTarjeta}
                onChange={(e) => setMontoTarjeta(e.target.value)}
                placeholder="0.00"
              />
              {selectedTarjeta && tarjetas.find(t => t.id === selectedTarjeta)?.tipo === 'credito' && selectedCuotas > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {(() => {
                    const cuotaConfig = tarjetaCuotas.find(c => c.tarjeta_id === selectedTarjeta && c.cuotas === selectedCuotas);
                    const monto = parseFloat(montoTarjeta.replace(',', '.')) || 0;
                    if (cuotaConfig && cuotaConfig.coeficiente > 1) {
                      return `Total con interés: $${(monto * cuotaConfig.coeficiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                    }
                    return null;
                  })()}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setTarjetaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddPagoTarjeta} disabled={!selectedTarjeta}>
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Efectivo Dialog */}
      <Dialog open={efectivoDialogOpen} onOpenChange={setEfectivoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pago en Efectivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span>Pendiente de cobro:</span>
                <span className="font-bold">${(total - totalPagado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div>
              <Label>Monto entregado por el cliente</Label>
              <Input
                type="text"
                value={efectivoEntregado}
                onChange={(e) => setEfectivoEntregado(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>

            {efectivoEntregado && (
              <div className="p-3 bg-muted rounded-lg">
                {(() => {
                  const entregado = parseFloat(efectivoEntregado.replace(',', '.')) || 0;
                  const pendiente = total - totalPagado;
                  const vuelto = entregado > pendiente ? entregado - pendiente : 0;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Entregado:</span>
                        <span>${entregado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {vuelto > 0 && (
                        <div className="flex justify-between font-bold text-lg text-success mt-2">
                          <span>Vuelto:</span>
                          <span>${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEfectivoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddPagoEfectivo}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Descuento Dialog */}
      <Dialog open={descuentoDialogOpen} onOpenChange={setDescuentoDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Aplicar Descuento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingDescuentoItem && (
              <p className="text-sm text-muted-foreground">
                {cart.find(i => i.id === editingDescuentoItem)?.producto?.descripcion || 
                 cart.find(i => i.id === editingDescuentoItem)?.nombre_temporal}
              </p>
            )}
            <div>
              <Label>Porcentaje de descuento</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={descuentoInput}
                  onChange={(e) => setDescuentoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGuardarDescuento();
                  }}
                  autoFocus
                />
                <span className="text-muted-foreground font-medium">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Máximo permitido: {getDescuentoMaximo()}%
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDescuentoDialogOpen(false);
                  setEditingDescuentoItem(null);
                  setDescuentoInput('');
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleGuardarDescuento}>
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Producto Temporal Dialog */}
      <Dialog open={productoTemporalDialogOpen} onOpenChange={setProductoTemporalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Producto Libre
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Agregue un producto que no está en el inventario. No se guardará en la base de datos.
            </p>
            <div>
              <Label>Nombre / Descripción</Label>
              <Input
                value={productoTemporal.nombre}
                onChange={(e) => setProductoTemporal({ ...productoTemporal, nombre: e.target.value })}
                placeholder="Ej: Producto especial"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={productoTemporal.precio}
                  onChange={(e) => setProductoTemporal({ ...productoTemporal, precio: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min={1}
                  value={productoTemporal.cantidad}
                  onChange={(e) => setProductoTemporal({ ...productoTemporal, cantidad: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setProductoTemporalDialogOpen(false);
                  setProductoTemporal({ nombre: '', precio: '', cantidad: '1' });
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleAgregarProductoTemporal}>
                Agregar al Carrito
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
            lastVenta.factura ? (
              // Diseño formal de factura electrónica
              <div id="printable-invoice" className="space-y-4">
                <div className="border-2 border-foreground rounded-lg text-sm bg-background">
                  {/* Header Principal - Formato AFIP */}
                  <div className="grid grid-cols-[1fr,auto,1fr] border-b-2 border-foreground">
                    {/* Datos Emisor */}
                    <div className="p-4 border-r-2 border-foreground">
                      <p className="font-bold text-xl">{comercioConfig?.nombre_fantasia || comercioConfig?.razon_social || 'EMPRESA'}</p>
                      <p className="text-muted-foreground text-sm">{comercioConfig?.razon_social}</p>
                      <p className="text-xs mt-2">{comercioConfig?.direccion}</p>
                      {comercioConfig?.localidad && (
                        <p className="text-xs">{comercioConfig.localidad}{comercioConfig.provincia ? `, ${comercioConfig.provincia}` : ''}{comercioConfig.codigo_postal ? ` (${comercioConfig.codigo_postal})` : ''}</p>
                      )}
                      {comercioConfig?.telefono && <p className="text-xs">Tel: {comercioConfig.telefono}</p>}
                      {comercioConfig?.email && <p className="text-xs">Email: {comercioConfig.email}</p>}
                    </div>
                    
                    {/* Letra del Comprobante */}
                    <div className="flex flex-col items-center justify-center px-6 border-r-2 border-foreground">
                      <div className="border-2 border-foreground w-16 h-16 flex items-center justify-center">
                        <span className="font-bold text-4xl">
                          {lastVenta.factura.tipo_comprobante === 1 ? 'A' : lastVenta.factura.tipo_comprobante === 6 ? 'B' : 'C'}
                        </span>
                      </div>
                      <p className="text-xs mt-1 font-medium">COD. {String(lastVenta.factura.tipo_comprobante).padStart(2, '0')}</p>
                    </div>
                    
                    {/* Datos Comprobante */}
                    <div className="p-4">
                      <p className="font-bold text-lg">
                        FACTURA {lastVenta.factura.tipo_comprobante === 1 ? 'A' : lastVenta.factura.tipo_comprobante === 6 ? 'B' : 'C'}
                      </p>
                      <p className="text-xl font-mono font-bold">
                        Nº {String(lastVenta.factura.punto_venta).padStart(4, '0')}-{String(lastVenta.factura.numero_comprobante).padStart(8, '0')}
                      </p>
                      <p className="text-sm mt-2">
                        <span className="font-medium">Fecha de Emisión:</span> {new Date(lastVenta.fecha).toLocaleDateString('es-AR')}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">CUIT:</span> {formatCuit(comercioConfig?.cuit || '')}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Condición IVA:</span> {comercioConfig?.condicion_iva || 'IVA Responsable Inscripto'}
                      </p>
                      {comercioConfig?.inicio_actividades && (
                        <p className="text-sm">
                          <span className="font-medium">Inicio Act.:</span> {new Date(comercioConfig.inicio_actividades).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Datos del Receptor */}
                  <div className="p-4 border-b-2 border-foreground bg-muted/30">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">CUIT/CUIL/DNI del Receptor:</p>
                        <p className="font-medium">{lastVenta.cliente?.dni_cuit || '0 - Sin identificar'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Condición frente al IVA:</p>
                        <p className="font-medium">{CONDICIONES_IVA.find(c => c.value === (lastVenta.cliente?.condicion_iva || 5))?.label || 'Consumidor Final'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Apellido y Nombre / Razón Social:</p>
                        <p className="font-medium">{lastVenta.cliente?.nombre || 'Consumidor Final'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Domicilio:</p>
                        <p className="font-medium">{lastVenta.cliente?.direccion || '-'}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Condición de Venta:</p>
                      <p className="font-medium">Contado</p>
                    </div>
                  </div>

                  {/* Detalle de Items */}
                  <div className="p-4 border-b-2 border-foreground">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-foreground">
                          <th className="text-left py-2 font-bold">Código</th>
                          <th className="text-left py-2 font-bold">Descripción</th>
                          <th className="text-center py-2 font-bold">Cantidad</th>
                          <th className="text-center py-2 font-bold">U. Med.</th>
                          <th className="text-right py-2 font-bold">Precio Unit.</th>
                          {lastVenta.factura.tipo_comprobante === 1 && (
                            <>
                              <th className="text-right py-2 font-bold">% IVA</th>
                              <th className="text-right py-2 font-bold">Subtotal</th>
                            </>
                          )}
                          {lastVenta.factura.tipo_comprobante !== 1 && (
                            <th className="text-right py-2 font-bold">Subtotal</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {lastVenta.detalles.map((item: CartItem, idx: number) => (
                          <tr key={idx} className="border-b border-muted">
                            <td className="py-2 text-xs">{item.producto?.codigo_articulo || '-'}</td>
                            <td className="py-2">{item.es_temporal ? item.nombre_temporal : item.producto?.descripcion}</td>
                            <td className="text-center py-2">{item.cantidad}</td>
                            <td className="text-center py-2">{item.producto?.unidad_medida || 'UN'}</td>
                            <td className="text-right py-2">${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            {lastVenta.factura.tipo_comprobante === 1 && (
                              <>
                                <td className="text-right py-2">21%</td>
                                <td className="text-right py-2">${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                              </>
                            )}
                            {lastVenta.factura.tipo_comprobante !== 1 && (
                              <td className="text-right py-2">${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totales */}
                  <div className="p-4 border-b-2 border-foreground">
                    <div className="flex justify-end">
                      <div className="w-80 space-y-1">
                        {lastVenta.factura.tipo_comprobante === 1 ? (
                          <>
                            <div className="flex justify-between">
                              <span>Importe Neto Gravado:</span>
                              <span>${lastVenta.factura.importe_neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>IVA 21%:</span>
                              <span>${lastVenta.factura.importe_iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Importe Otros Tributos:</span>
                              <span>$0,00</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>${lastVenta.factura.importe_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t-2 border-foreground pt-2 mt-2">
                          <span>IMPORTE TOTAL:</span>
                          <span>${lastVenta.factura.importe_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CAE y Datos AFIP */}
                  <div className="p-4 bg-muted/30">
                    <div className="grid grid-cols-[1fr,auto] gap-4">
                      <div>
                        <p className="font-bold text-sm">CAE Nº: {lastVenta.factura.cae}</p>
                        <p className="text-sm">Fecha de Vto. de CAE: {lastVenta.factura.cae_vencimiento}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Comprobante Autorizado</p>
                        <p>AFIP - Factura Electrónica</p>
                        <p className="mt-1">Consulte validez en:</p>
                        <p>www.afip.gob.ar/fe/qr/</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Factura
                </Button>
              </div>
            ) : (
              // Diseño simple de ticket
              <div id="printable-invoice" className="space-y-4">
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
                        <span>
                          {item.cantidad}x {item.es_temporal ? item.nombre_temporal : item.producto?.descripcion?.substring(0, 25)}
                        </span>
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

                <Button className="w-full" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Factura Dialog */}
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

            {/* Mostrar desglose si hay intereses */}
            {totalPagado > total && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal productos:</span>
                  <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Intereses tarjeta:</span>
                  <span>+${(totalPagado - total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold">
              <span>Total a facturar:</span>
              <span>${(totalPagado > 0 ? totalPagado : total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
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
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCargarPedido(pedido)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleEliminarPedido(pedido.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                {cart.find(i => i.id === editingPesoItem)?.producto?.descripcion}
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
                    if (e.key === 'Enter') handleGuardarPeso();
                  }}
                  autoFocus
                  className="text-lg"
                />
                <span className="text-muted-foreground font-medium">kg</span>
              </div>
            </div>
            {editingPesoItem && pesoInput && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Precio por kg:</span>
                  <span>${cart.find(i => i.id === editingPesoItem)?.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold mt-1">
                  <span>Subtotal:</span>
                  <span>
                    ${(
                      (cart.find(i => i.id === editingPesoItem)?.precio || 0) * 
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

      {/* Modal de Búsqueda de Productos */}
      <ProductSearchModal
        open={productSearchModalOpen}
        onOpenChange={setProductSearchModalOpen}
        productos={productos}
        getProductoPrice={getProductoPrice}
        onSelectProduct={handleProductSelectedFromModal}
      />

      {/* Modal de Selección de Cantidad */}
      <ProductQuantityModal
        open={productQuantityModalOpen}
        onOpenChange={setProductQuantityModalOpen}
        producto={selectedProductForQuantity}
        precio={selectedProductForQuantity ? getProductoPrice(selectedProductForQuantity) : 0}
        onConfirm={handleConfirmProductQuantity}
      />
    </MainLayout>
  );
}
